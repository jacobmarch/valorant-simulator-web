import { mkdir, rename } from 'node:fs/promises'
import {
  type AgentStats,
  derivePlayer,
  importRoster,
  type PlayerDatabase,
  validateDatabase,
} from '../src/player-database'
import { seedTeams } from '../src/seed'

const base = process.env.VLR_API_BASE_URL ?? 'http://127.0.0.1:3001'
const timespan = process.env.VLR_TIMESPAN ?? '90d'
if (!['30d', '60d', '90d', 'all'].includes(timespan))
  throw new Error('VLR_TIMESPAN must be 30d, 60d, 90d, or all.')
// Optional explicit game-team ID -> VLR numeric ID mapping for renamed/ambiguous organizations.
const mappingPath = process.env.VLR_TEAM_MAPPING
const mapping: Record<string, string> = mappingPath ? await Bun.file(mappingPath).json() : {}
const raw: { url: string; fetchedAt: string; payload: unknown }[] = []
async function request(path: string, params: Record<string, string>) {
  const url = new URL(path, base)
  url.search = new URLSearchParams(params).toString()
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`)
      const payload = await response.json()
      if (
        payload.status !== 'success' ||
        !payload.data ||
        (payload.data.status && payload.data.status !== 200)
      )
        throw new Error(`Invalid API response from ${url}`)
      raw.push({ url: url.toString(), fetchedAt: new Date().toISOString(), payload })
      await Bun.sleep(1000)
      return payload.data
    } catch (error) {
      if (attempt === 2) throw error
      await Bun.sleep(1000 * 2 ** attempt)
    }
  }
  throw new Error('Unreachable')
}
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
  let vlrId = mapping[team.id]
  if (!vlrId) {
    const data = await request('/v2/search', { q: team.name })
    const results = data.segments?.results?.teams
    if (!Array.isArray(results)) throw new Error('Search response schema changed.')
    const exact = results.filter(
      (result: any) =>
        result.name?.toLowerCase().trim() === team.name.toLowerCase().trim() &&
        !/inactive/i.test(result.tag ?? ''),
    )
    if (exact.length !== 1)
      throw new Error(
        `Cannot uniquely resolve ${team.name}. Set its VLR ID in VLR_TEAM_MAPPING (${team.id}).`,
      )
    vlrId = exact[0].id
  }
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
  console.log(`${team.name}: 5 starters, ${members.length - 5} substitutes`)
}
db.fetchedAt = new Date().toISOString()
validateDatabase(db)
await mkdir('data/vlr', { recursive: true })
await mkdir('public/data', { recursive: true })
await Bun.write(`data/vlr/${db.fetchedAt.replace(/[:.]/g, '-')}.json`, JSON.stringify(raw, null, 2))
await Bun.write('public/data/players.json.tmp', JSON.stringify(db, null, 2))
await rename('public/data/players.json.tmp', 'public/data/players.json')
console.log(`Published ${db.players.length} players. Existing career saves remain unchanged.`)
