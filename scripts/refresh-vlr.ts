import { mkdir, rename } from 'node:fs/promises'
import {
  type AgentStats,
  derivePlayer,
  importRoster,
  type PlayerDatabase,
  validateDatabase,
} from '../src/player-database'
import { seedTeams } from '../src/seed'
import { createVlrClient, requestInterval } from './vlr-client'
import { resolveTeamId } from './vlr-teams'

const base = process.env.VLR_API_BASE_URL ?? 'http://127.0.0.1:3001'
const intervalMs = requestInterval(process.env.VLR_REQUEST_INTERVAL_MS)
const timespan = process.env.VLR_TIMESPAN ?? '90d'
if (!['30d', '60d', '90d', 'all'].includes(timespan))
  throw new Error('VLR_TIMESPAN must be 30d, 60d, 90d, or all.')
// Optional explicit game-team ID -> VLR numeric ID mapping for renamed/ambiguous organizations.
const mappingPath = process.env.VLR_TEAM_MAPPING
const mapping: Record<string, string> = mappingPath ? await Bun.file(mappingPath).json() : {}
const raw: { url: string; fetchedAt: string; payload: unknown }[] = []
const request = createVlrClient({
  base,
  intervalMs,
  fetch,
  sleep: Bun.sleep,
  warn: console.warn,
  onSuccess: (url, payload) => raw.push({ url, fetchedAt: new Date().toISOString(), payload }),
})
console.log(
  `VLR requests spaced at least ${intervalMs / 1000}s apart (${Math.round(60_000 / intervalMs)} calls/minute).`,
)
function segment(data: any) {
  if (!Array.isArray(data.segments) || data.segments.length !== 1)
    throw new Error('Expected one profile segment; upstream schema may have changed.')
  return data.segments[0]
}
const db: PlayerDatabase = {
  version: 1,
  fetchedAt: '',
  source: base,
  timespan: timespan as PlayerDatabase['timespan'],
  model: 'vlr-proxies-v1',
  teams: [],
  players: [],
}
for (const team of seedTeams) {
  const vlrId = mapping[team.id] ?? (await resolveTeamId(team, request))
  if (!/^\d+$/.test(String(vlrId)) || Number(vlrId) <= 0)
    throw new Error(`Invalid VLR team ID for ${team.id}`)
  const roster = segment(await request('/v2/team', { id: String(vlrId), q: 'roster' }))
  if (!Array.isArray(roster.active) || !Array.isArray(roster.benched))
    throw new Error(`Roster schema changed for ${team.name}`)
  const members = importRoster(roster.active, roster.benched, team.name)
  for (const { member, status } of members) {
    if (!/^\d+$/.test(String(member.id)) || Number(member.id) <= 0)
      throw new Error(`Missing player ID for ${member.alias}`)
    const profile = segment(
      await request('/v2/player', { id: String(member.id), q: 'profile', timespan }),
    )
    if (!profile.name || !Array.isArray(profile.agent_stats))
      throw new Error(`Player schema changed for ${member.alias}`)
    const stats: AgentStats[] = profile.agent_stats
    if (stats.some((row) => typeof row.agent !== 'string'))
      throw new Error(`Invalid agent data for ${member.alias}`)
    const derived = derivePlayer(stats)
    db.players.push({
      id: `vlr-${member.id}`,
      name: profile.name,
      teamId: team.id,
      status,
      primaryRole: derived.primaryRole,
      secondaryRoles: derived.secondaryRoles,
      ratings: derived.ratings,
      evidence: {
        url: `https://www.vlr.gg/player/${member.id}`,
        rounds: derived.rounds,
        agentStats: stats,
        unmeasured: [
          'Clutch',
          'leadership',
          'age',
          'potential',
          'salary',
          'contract',
          'import eligibility',
          ...(derived.rounds === 0 ? ['all ratings', 'role'] : []),
        ],
      },
    })
  }
  db.teams.push({ id: team.id, vlrId: String(vlrId), name: team.name })
  const starters = members.filter((member) => member.status === 'starter').length
  console.log(`${team.name}: ${starters} starters, ${members.length - starters} substitutes`)
}
db.fetchedAt = new Date().toISOString()
validateDatabase(db)
await mkdir('data/vlr', { recursive: true })
await mkdir('public/data', { recursive: true })
await Bun.write(`data/vlr/${db.fetchedAt.replace(/[:.]/g, '-')}.json`, JSON.stringify(raw, null, 2))
await Bun.write('public/data/players.json.tmp', JSON.stringify(db, null, 2))
await rename('public/data/players.json.tmp', 'public/data/players.json')
console.log(`Published ${db.players.length} players. Existing career saves remain unchanged.`)
