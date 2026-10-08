import type { Ratings } from './game'
import { MAX_ROSTER, MIN_ROSTER } from './roster-limits'
import { type Role, roles, seedTeams, skills } from './seed'

export type VlrRosterMember = {
  id: string
  alias: string
  role?: string
  is_staff?: boolean
}

/** VLR active membership is a roster, not a confirmed match starting five. */
export function importRoster(
  active: VlrRosterMember[],
  benched: VlrRosterMember[],
  teamName: string,
) {
  const isPlayer = (member: VlrRosterMember) =>
    !member.is_staff && !/coach|staff|manager|analyst/i.test(member.role ?? '')
  const eligible = active.filter(isPlayer)
  if (eligible.length > MAX_ROSTER)
    throw new Error(`${teamName} has ${eligible.length} active players; maximum ${MAX_ROSTER}.`)
  const reserves = benched.filter(isPlayer)
  if (eligible.length + reserves.length > MAX_ROSTER)
    throw new Error(
      `${teamName} has ${eligible.length + reserves.length} roster players including benched players; maximum ${MAX_ROSTER}.`,
    )
  // Use VLR display order as a default lineup; reserve status here is a game choice.
  return [...eligible, ...reserves].map((member, index) => ({
    member,
    status: (index < eligible.length && index < MIN_ROSTER
      ? 'starter'
      : 'substitute') as DatabasePlayer['status'],
  }))
}

export type AgentStats = Record<string, unknown> & { agent: string }
export type DatabasePlayer = {
  id: string
  name: string
  teamId: string
  status: 'starter' | 'substitute'
  primaryRole: Role
  secondaryRoles: Role[]
  ratings: Ratings
  evidence: {
    url: string
    rounds: number
    agentStats: AgentStats[]
    unmeasured: string[]
  }
}
export type PlayerDatabase = {
  version: 1
  fetchedAt: string
  source: string
  timespan: '30d' | '60d' | '90d' | 'all'
  model: 'vlr-proxies-v1'
  teams: { id: string; vlrId: string; name: string }[]
  players: DatabasePlayer[]
}

const agentRoles: Record<string, Role> = Object.fromEntries(
  (
    [
      ['Duelist', 'jett raze reyna phoenix neon yoru iso waylay'],
      ['Initiator', 'sova breach skye kayo fade gekko tejo'],
      ['Controller', 'brimstone omen viper astra harbor clove'],
      ['Sentinel', 'sage cypher killjoy chamber deadlock vyse veto'],
    ] as const
  ).flatMap(([role, agents]) => agents.split(' ').map((agent) => [agent, role])),
)

export function numeric(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const text = String(value).trim().replace(/,/g, '').replace(/%$/, '')
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

/** Round-weighted proxies, shrunk toward 70 with 400 prior rounds. Missing data stays neutral. */
export function derivePlayer(agentStats: AgentStats[]) {
  const rows = agentStats.filter((row) => (numeric(row.rounds) ?? 0) > 0)
  const rounds = rows.reduce((sum, row) => sum + (numeric(row.rounds) ?? 0), 0)
  const mean = (key: string) => {
    const valid = rows.filter((row) => numeric(row[key]) !== null)
    const weight = valid.reduce((sum, row) => sum + (numeric(row.rounds) ?? 0), 0)
    return weight
      ? valid.reduce((sum, row) => sum + numeric(row[key])! * numeric(row.rounds)!, 0) / weight
      : null
  }
  const proxy = (key: string, center: number, scale: number) => {
    const value = mean(key)
    const weight = rows
      .filter((row) => numeric(row[key]) !== null)
      .reduce((sum, row) => sum + numeric(row.rounds)!, 0)
    return value === null
      ? 70
      : 70 + (Math.max(-30, Math.min(29, (value - center) * scale)) * weight) / (weight + 400)
  }
  const ratings: Ratings = {
    Mechanics: Math.round(
      (proxy('acs', 200, 0.2) + proxy('adr', 130, 0.3) + proxy('kpr', 0.7, 65)) / 3,
    ),
    Tactics: Math.round(proxy('rating', 1, 35)),
    Utility: Math.round(proxy('apr', 0.25, 80)),
    Consistency: Math.round(proxy('kast', 70, 1.8)),
    Clutch: 70,
    Teamplay: Math.round((proxy('kast', 70, 1.8) + proxy('apr', 0.25, 80)) / 2),
  }
  const usage = new Map<Role, number>()
  for (const row of rows) {
    const role = agentRoles[row.agent.toLowerCase().replace(/[^a-z]/g, '')]
    if (role) usage.set(role, (usage.get(role) ?? 0) + numeric(row.rounds)!)
  }
  const ranked = [...usage].sort((a, b) => b[1] - a[1])
  const primaryRole: Role = ranked[0]?.[0] ?? 'Flex'
  const secondaryRoles = ranked
    .slice(1)
    .filter(([, count]) => count / rounds >= 0.2)
    .map(([role]) => role)
  return { ratings, primaryRole, secondaryRoles, rounds }
}

export function validateDatabase(value: unknown): PlayerDatabase {
  const db = value as PlayerDatabase
  if (
    !db ||
    db.version !== 1 ||
    db.model !== 'vlr-proxies-v1' ||
    !Number.isFinite(Date.parse(db.fetchedAt)) ||
    !['30d', '60d', '90d', 'all'].includes(db.timespan) ||
    typeof db.source !== 'string' ||
    !Array.isArray(db.teams) ||
    !Array.isArray(db.players)
  )
    throw new Error('Invalid player database metadata.')
  const teamIds = new Set(db.teams.map((team) => team.id))
  if (
    teamIds.size !== seedTeams.length ||
    db.teams.length !== seedTeams.length ||
    seedTeams.some((team) => !teamIds.has(team.id))
  )
    throw new Error('The database must cover all 48 game organizations.')
  const seen = new Set<string>()
  for (const player of db.players) {
    if (
      !/^vlr-\d+$/.test(player.id) ||
      seen.has(player.id) ||
      !player.name?.trim() ||
      !teamIds.has(player.teamId) ||
      !['starter', 'substitute'].includes(player.status) ||
      !roles.includes(player.primaryRole) ||
      !Array.isArray(player.secondaryRoles) ||
      player.secondaryRoles.some((role) => !roles.includes(role)) ||
      skills.some(
        (skill) =>
          !Number.isInteger(player.ratings?.[skill]) ||
          player.ratings[skill] < 1 ||
          player.ratings[skill] > 99,
      ) ||
      !player.evidence ||
      !Array.isArray(player.evidence.agentStats) ||
      !Number.isFinite(player.evidence.rounds) ||
      player.evidence.rounds < 0
    )
      throw new Error(`Invalid or duplicate database player: ${player.id}`)
    seen.add(player.id)
  }
  for (const team of db.teams) {
    const roster = db.players.filter((player) => player.teamId === team.id)
    if (
      roster.filter((player) => player.status === 'starter').length > MIN_ROSTER ||
      roster.length > MAX_ROSTER
    )
      throw new Error(
        `Invalid roster for ${team.id}: maximum ${MIN_ROSTER} starters and ${MAX_ROSTER} players.`,
      )
  }
  return db
}
