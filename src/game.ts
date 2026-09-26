import {
  previousChampionsByRegion,
  roles,
  seedTeams,
  skills,
  tier2Targets,
  type Region,
  type Role,
} from './seed'
import {
  DEFAULT_TRAINING,
  MORALE_DEFAULT,
  agePlayer as ageDevelopment,
  conditionBonus,
  developPlayer,
  formAfterSeries,
  moraleAfterSeries,
  overallRating,
  seedPotential,
} from './development'
import { bestRoleAssignment, compositionPenalty, roleRating } from './roles'
import { attackerEdge, describeVeto, mapFit, runVeto } from './maps'
import { recordMove, replenishFreeAgents, runAiTransfers } from './transfers'

export type Skill = (typeof skills)[number]
export type DelegationMode = 'hands-on' | 'balanced' | 'hands-off'
export type PlayerStatus = 'starter' | 'substitute' | 'inactive' | 'free-agent'
export type CompetitionPhase =
  | 'Kickoff'
  | 'Masters 1'
  | 'Stage 1'
  | 'Masters 2'
  | 'Stage 2'
  | 'Champions'
  | 'Break'
  | 'Offseason'
export type Ratings = Record<Skill, number>
export type Player = {
  id: string
  name: string
  teamId: string | null
  region: Region | null
  primaryRole: Role
  secondaryRoles: Role[]
  ratings: Ratings
  age: number
  salary: number
  years: number
  status: PlayerStatus
  isImport: boolean
  scoutProgress: number
  potential: number
  form: number
  morale: number
}
export type Team = {
  id: string
  name: string
  short: string
  region: Region
  color: string
  playerIds: string[]
  lineup: string[]
  roleAssignments: Record<string, Role>
  cash: number
  salaryBudget: number
  wins: number
  losses: number
  mapWins: number
  mapLosses: number
  championshipPoints: number
  playoffStage: string
  /** The manager's map order, best first. Only read for the managed team. */
  mapOrder?: string[]
}
export type PlayerStat = {
  kills: number
  deaths: number
  assists: number
  acs: number
  adr: number
  kast: number
  firstKills: number
  firstDeaths: number
  clutches: number
  plants: number
  defuses: number
  headshots: number
}
export type MapResult = {
  map: string
  aScore: number
  bScore: number
  winnerId: string
  rounds: string[]
  stats: Record<string, PlayerStat>
}
export type MatchResult = {
  id: string
  fixtureId?: string
  season: number
  week: number
  phase: string
  aId: string
  bId: string
  bestOf: 3 | 5
  winnerId: string
  aScore: number
  bScore: number
  maps: MapResult[]
  highlights: string[]
  veto: string[]
  vetoLog?: string[]
  attackStyle: string
  defenseStyle: string
}
export type Fixture = {
  id: string
  season: number
  week: number
  phase: Exclude<CompetitionPhase, 'Break' | 'Offseason'>
  scope: 'regional' | 'international'
  region?: Region
  round: number
  label: string
  aId: string
  bId: string | null
  bestOf: 3 | 5
  status: 'scheduled' | 'completed'
  winnerId?: string
  resultId?: string
  stage?: 'Swiss' | 'Groups' | 'Playoffs' | 'League'
  bracket?: 'Swiss' | 'Group' | 'Upper' | 'Lower' | 'Final'
  group?: 'A' | 'B' | 'C' | 'D'
}
export type KickoffRecord = {
  wins: number
  losses: number
  status: 'active' | 'qualified' | 'eliminated'
  openingBye: boolean
}
export type JobOffer = {
  id: string
  teamId: string
  expiresWeek: number
  reason: string
  salary: number
  status: 'pending' | 'accepted' | 'declined'
}
export type TransferRecord = {
  id: string
  season: number
  week: number
  kind: 'signing' | 'buyout' | 'release' | 'status' | 'renewal' | 'expiry'
  playerId: string
  playerName: string
  fromTeamId: string | null
  toTeamId: string | null
  fee: number
  note?: string
}
export type GameState = {
  version: 12
  season: number
  week: number
  managerName: string
  currentTeamId: string
  teams: Record<string, Team>
  players: Record<string, Player>
  matches: MatchResult[]
  fixtures: Fixture[]
  kickoff: Record<string, KickoffRecord>
  inbox: string[]
  jobs: JobOffer[]
  transfers: TransferRecord[]
  training: Record<string, Partial<Record<Skill, number>>>
  scoutingHours: Record<string, number>
  settings: Record<string, DelegationMode | boolean>
  rng: number
  saveTimestamp: string
}

const SAVE_KEY = 'vct-manager-mvp-save-v1'
const regions: Region[] = ['Americas', 'EMEA', 'Pacific', 'China']
const openingKickoffByes = new Set(Object.values(previousChampionsByRegion).flat())
const breakWeeks: Record<number, string> = {
  7: 'Masters 1',
  19: 'Masters 2',
  23: 'Stage 2',
  32: 'Champions',
  33: 'Champions',
  34: 'Champions',
  35: 'Champions',
  43: 'Offseason',
}
const roleFor = (index: number): Role => roles[index % roles.length]
const emptyRatings = (base: number): Ratings => ({
  Mechanics: base,
  Tactics: base - 2,
  Utility: base - 3,
  Consistency: base - 1,
  Clutch: base - 4,
  Teamplay: base - 2,
})
// Seeded players get a role-shaped profile plus a small deterministic spread so
// teams differ in aim, utility and trading, which is what map tiers read.
const roleShape: Record<Role, number[]> = {
  Duelist: [4, -2, -3, 0, 1, 0],
  Initiator: [-1, 1, 3, -1, -3, 1],
  Controller: [-3, 3, 4, 0, -2, -2],
  Sentinel: [-1, 0, 1, 2, 1, -3],
  Flex: [0, 0, 0, 0, 0, 0],
}
const seedRatings = (base: number, role: Role, teamIndex: number, playerIndex: number) => {
  const flat = emptyRatings(base)
  const spread = skills.map(
    (_, skillIndex) => ((teamIndex * 13 + playerIndex * 7 + skillIndex * 11) % 9) - 4,
  )
  const offset = spread.reduce((sum, value) => sum + value, 0) / spread.length
  return Object.fromEntries(
    skills.map((skill, skillIndex) => [
      skill,
      clamp(
        Math.round(flat[skill] + roleShape[role][skillIndex] + spread[skillIndex] - offset),
        40,
        99,
      ),
    ]),
  ) as Ratings
}
const random = (state: GameState) => {
  state.rng = (state.rng * 1664525 + 1013904223) >>> 0
  return state.rng / 4294967296
}
const seedAge = (teamIndex: number, playerIndex: number) =>
  19 + ((teamIndex * 5 + playerIndex * 3) % 10)
const money = (value: number) => Math.round(value / 1000) * 1000
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function phaseForWeek(week: number): CompetitionPhase {
  if (breakWeeks[week]) return 'Break'
  if (week <= 6) return 'Kickoff'
  if (week <= 10) return 'Masters 1'
  if (week <= 18) return 'Stage 1'
  if (week <= 22) return 'Masters 2'
  if (week <= 31) return 'Stage 2'
  if (week <= 42) return 'Champions'
  return 'Offseason'
}
export function activePhaseForWeek(week: number): Exclude<CompetitionPhase, 'Break'> {
  if (breakWeeks[week]) {
    let next = week + 1
    while (breakWeeks[next] && breakWeeks[next] === breakWeeks[week]) next++
    const nextPhase = phaseForWeek(next)
    return nextPhase === 'Break' ? 'Offseason' : nextPhase
  }
  return phaseForWeek(week) as Exclude<CompetitionPhase, 'Break'>
}
export function phaseLabel(week: number) {
  const phase = phaseForWeek(week)
  if (phase === 'Break') return `Break before ${breakWeeks[week]}`
  if (phase === 'Masters 1') return 'Masters 1 · São Paulo'
  if (phase === 'Masters 2') return 'Masters 2 · Berlin'
  if (phase === 'Champions') return 'Champions · Seoul'
  return phase
}
export function isInternationalPhase(phase: CompetitionPhase | string) {
  return (
    phase === 'Masters 1' ||
    phase === 'Masters 2' ||
    phase === 'Champions' ||
    phase.includes('Masters') ||
    phase.includes('Champions')
  )
}
export function dateForWeek(week: number) {
  const date = new Date(2026, 0, 1)
  date.setDate(date.getDate() + (week - 1) * 7)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function createGame(managerName: string, currentTeamId: string): GameState {
  const players: Record<string, Player> = {}
  const teams: Record<string, Team> = {}
  seedTeams.forEach((seed, teamIndex) => {
    const playerIds = seed.players.map((name, playerIndex) => {
      const id = `${seed.id}-${playerIndex}`
      const base = Math.max(58, Math.min(88, 68 + ((teamIndex * 7 + playerIndex * 3) % 18)))
      const primaryRole = roleFor(playerIndex)
      players[id] = {
        id,
        name,
        teamId: seed.id,
        region: seed.region,
        primaryRole,
        secondaryRoles:
          playerIndex === 4
            ? roles.filter((role) => role !== primaryRole).slice(0, 2)
            : playerIndex === 2
              ? [roles[(playerIndex + 1) % roles.length]]
              : [],
        ratings: seedRatings(base, primaryRole, teamIndex, playerIndex),
        age: seedAge(teamIndex, playerIndex),
        salary: money(55000 + base * 1400),
        years: 1 + (playerIndex % 3),
        status: 'starter',
        isImport: playerIndex === 0 && teamIndex % 5 === 0,
        scoutProgress: 100,
        potential: 0,
        form: 0,
        morale: MORALE_DEFAULT,
      }
      players[id].potential = seedPotential(
        overallRating(players[id].ratings),
        players[id].age,
        (teamIndex * 3 + playerIndex * 5) % 5,
      )
      return id
    })
    const lineup = playerIds.slice(0, 5)
    teams[seed.id] = {
      id: seed.id,
      name: seed.name,
      short: seed.short,
      region: seed.region,
      color: seed.color,
      playerIds,
      lineup,
      roleAssignments: Object.fromEntries(lineup.map((id) => [id, players[id].primaryRole])),
      cash: 1000000 + (12 - (teamIndex % 12)) * 50000,
      salaryBudget: 800000,
      wins: 0,
      losses: 0,
      mapWins: 0,
      mapLosses: 0,
      championshipPoints: 0,
      playoffStage: 'Kickoff · 3 lives',
    }
  })
  tier2Targets.forEach((name, index) => {
    const id = `tier2-${index}`
    players[id] = {
      id,
      name:
        ['N4RRATE', 'rhyme', 'Tixx', 'Jex', 'Dambi', 'paTiTek'][index] ?? `Prospect ${index + 1}`,
      teamId: null,
      region: null,
      primaryRole: roleFor(index + 1),
      secondaryRoles: [],
      ratings: emptyRatings(62 + index * 2),
      age: 17 + (index % 4),
      salary: 35000 + index * 4000,
      years: 1,
      status: 'free-agent',
      isImport: false,
      scoutProgress: 0,
      potential: 0,
      form: 0,
      morale: MORALE_DEFAULT,
    }
    players[id].potential = seedPotential(
      overallRating(players[id].ratings),
      players[id].age,
      2 + (index % 3),
    )
  })
  const state: GameState = {
    version: 12,
    season: 2026,
    week: 1,
    managerName: managerName || 'Manager',
    currentTeamId,
    teams,
    players,
    matches: [],
    fixtures: [],
    kickoff: Object.fromEntries(
      Object.keys(teams).map((id) => [
        id,
        { wins: 0, losses: 0, status: 'active', openingBye: openingKickoffByes.has(id) },
      ]),
    ),
    inbox: [
      'Welcome to the 2026 VCT season. Your first Kickoff matchup is on the competition board.',
    ],
    jobs: [],
    transfers: [],
    training: {},
    scoutingHours: {},
    settings: {
      roster: 'hands-on',
      training: 'hands-on',
      scouting: 'hands-on',
      finances: 'balanced',
      sponsorships: false,
      personalities: false,
    },
    rng: 20260201,
    saveTimestamp: new Date().toISOString(),
  }
  replenishFreeAgents(state)
  ensureWeekScheduled(state, 1)
  return state
}
function migrateGame(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null
  const legacy = raw as Partial<GameState> & { teams?: Record<string, Team> }
  if (!legacy.teams || !legacy.players || !legacy.currentTeamId) return null
  const state = legacy as GameState
  const previousVersion = Number(state.version ?? 1)
  state.fixtures ??= []
  state.fixtures.forEach((fixture) => {
    fixture.season ??= state.season
  })
  state.matches.forEach((match) => {
    match.season ??= state.season
  })
  if (previousVersion < 4) {
    state.fixtures = state.fixtures.filter(
      (fixture) =>
        !(
          fixture.season === state.season &&
          regionalPlayoffPhase(fixture.phase) &&
          fixture.status === 'scheduled'
        ),
    )
    state.inbox.unshift('Regional split playoffs are now scheduled after league play.')
  }
  state.kickoff ??= Object.fromEntries(
    Object.keys(state.teams).map((id) => [
      id,
      { wins: 0, losses: 0, status: 'active' as const, openingBye: false },
    ]),
  )
  if (previousVersion < 5) {
    const openingByes = new Set(
      state.season === 2026
        ? Object.values(previousChampionsByRegion).flat()
        : regions.flatMap((region) => regionalPlayoffQualifiers(state, 'Stage 2', region, 4)),
    )
    Object.entries(state.kickoff).forEach(([id, record]) => {
      record.openingBye = openingByes.has(id)
    })
    if (state.week === 1)
      state.fixtures = state.fixtures.filter(
        (fixture) =>
          !(
            fixture.season === state.season &&
            fixture.phase === 'Kickoff' &&
            fixture.week === 1 &&
            fixture.status === 'scheduled'
          ),
      )
    state.inbox.unshift('Kickoff now gives returning Champions teams an opening-round bye.')
  }
  if (previousVersion < 6) {
    state.fixtures
      .filter(
        (fixture) =>
          fixture.season === state.season &&
          fixture.phase === 'Kickoff' &&
          fixture.status === 'scheduled' &&
          (fixture.round >= 6 || fixture.label === 'Qualification decider'),
      )
      .forEach((fixture) => {
        fixture.bestOf = 5
      })
    state.inbox.unshift('Kickoff closing-path series now use best-of-five.')
  }
  if (previousVersion < 7) {
    const kickoffFinals = ['Upper Final', 'Middle Final', 'Lower Final']
    if (state.week <= 6) {
      const kickoffFixtureIds = new Set(
        state.fixtures
          .filter((fixture) => fixture.season === state.season && fixture.phase === 'Kickoff')
          .map((fixture) => fixture.id),
      )
      state.fixtures = state.fixtures.filter(
        (fixture) => !(fixture.season === state.season && fixture.phase === 'Kickoff'),
      )
      state.matches = state.matches.filter(
        (match) => match.phase !== 'Kickoff' && !kickoffFixtureIds.has(match.fixtureId ?? ''),
      )
      Object.entries(state.kickoff).forEach(([id, record]) => {
        record.wins = 0
        record.losses = 0
        record.status = 'active'
        state.teams[id].wins = 0
        state.teams[id].losses = 0
        state.teams[id].mapWins = 0
        state.teams[id].mapLosses = 0
        state.teams[id].playoffStage = record.openingBye
          ? 'Kickoff · Round 1 bye'
          : 'Kickoff · 3 lives'
      })
      state.week = 1
      state.inbox.unshift('Kickoff was reset to the fixed triple-elimination bracket.')
    } else {
      state.fixtures
        .filter((fixture) => fixture.season === state.season && fixture.phase === 'Kickoff')
        .forEach((fixture) => {
          fixture.bestOf = kickoffFinals.includes(fixture.label) ? 5 : 3
        })
    }
  }
  if (previousVersion === 7 && state.week <= 6) {
    const invalidFixtureIds = new Set(
      state.fixtures
        .filter((fixture) => fixture.season === state.season && fixture.phase === 'Kickoff')
        .map((fixture) => fixture.id),
    )
    state.fixtures = state.fixtures.filter(
      (fixture) => !(fixture.season === state.season && fixture.phase === 'Kickoff'),
    )
    state.matches = state.matches.filter(
      (match) => match.phase !== 'Kickoff' && !invalidFixtureIds.has(match.fixtureId ?? ''),
    )
    Object.entries(state.kickoff).forEach(([id, record]) => {
      record.wins = 0
      record.losses = 0
      record.status = 'active'
      state.teams[id].wins = 0
      state.teams[id].losses = 0
      state.teams[id].mapWins = 0
      state.teams[id].mapLosses = 0
      state.teams[id].playoffStage = record.openingBye
        ? 'Kickoff · Round 1 bye'
        : 'Kickoff · 3 lives'
    })
    state.week = 1
    state.inbox.unshift('Kickoff was reset to the corrected no-bye middle and lower bracket.')
  }
  const active = phaseForWeek(state.week)
  if (previousVersion < 3 && isInternationalPhase(active)) {
    const phase = active as 'Masters 1' | 'Masters 2' | 'Champions'
    const legacyFixtures = state.fixtures.filter(
      (fixture) => fixture.season === state.season && fixture.phase === phase && !fixture.stage,
    )
    if (legacyFixtures.length) {
      const legacyIds = new Set(legacyFixtures.map((fixture) => fixture.id))
      state.fixtures = state.fixtures.filter(
        (fixture) => !(fixture.season === state.season && fixture.phase === phase),
      )
      state.matches = state.matches.filter(
        (match) => !match.fixtureId || !legacyIds.has(match.fixtureId),
      )
      state.week = phase === 'Masters 1' ? 8 : phase === 'Masters 2' ? 20 : 36
      state.inbox.unshift(`${phase} was restarted with the corrected 2026 tournament format.`)
    }
  }
  Object.values(state.players).forEach((player) => {
    if (typeof player.age === 'number') return
    const [teamIndex, playerIndex] = player.id.startsWith('tier2-')
      ? [-1, Number(player.id.slice(6))]
      : [
          seedTeams.findIndex((team) => player.id.startsWith(`${team.id}-`)),
          Number(player.id.split('-').at(-1)),
        ]
    player.age =
      teamIndex < 0 ? 17 + ((playerIndex || 0) % 4) : seedAge(teamIndex, playerIndex || 0)
  })
  if (previousVersion < 10) {
    Object.values(state.players).forEach((player, index) => {
      player.potential ??= seedPotential(overallRating(player.ratings), player.age, index % 5)
      player.form = Number.isFinite(player.form) ? player.form : 0
      player.morale ??= MORALE_DEFAULT
    })
    state.inbox.push('Players now have potential, form and morale.')
  }
  state.transfers ??= []
  if (previousVersion < 11) replenishFreeAgents(state)
  if (previousVersion < 12) {
    const stage1 = regionalPlayoffConfig('Stage 1'),
      stage2 = regionalPlayoffConfig('Stage 2')
    if (state.week > stage1.regularStart && state.week <= stage1.regularEnd)
      restartStage(state, 'Stage 1')
    if (
      state.week >= stage2.regularStart &&
      state.week <= 34 &&
      !Object.values(state.teams).some((team) =>
        team.playoffStage.startsWith('Champions qualifier'),
      )
    )
      restartStage(state, 'Stage 2')
  }
  state.version = 12
  pruneHistory(state)
  ensureWeekScheduled(state, state.week)
  return state
}
/** Drops a legacy round-robin Stage and restarts it with the group format. */
function restartStage(state: GameState, phase: 'Stage 1' | 'Stage 2') {
  const dropped = new Set(
    state.fixtures
      .filter((fixture) => fixture.season === state.season && fixture.phase === phase)
      .map((fixture) => fixture.id),
  )
  state.matches
    .filter((match) => match.fixtureId && dropped.has(match.fixtureId))
    .forEach((match) => {
      const a = state.teams[match.aId],
        b = state.teams[match.bId]
      if (!a || !b) return
      a.wins -= match.winnerId === a.id ? 1 : 0
      a.losses -= match.winnerId === a.id ? 0 : 1
      b.wins -= match.winnerId === b.id ? 1 : 0
      b.losses -= match.winnerId === b.id ? 0 : 1
      a.mapWins -= match.aScore
      a.mapLosses -= match.bScore
      b.mapWins -= match.bScore
      b.mapLosses -= match.aScore
      if (state.teams[match.winnerId]) state.teams[match.winnerId].championshipPoints--
    })
  state.fixtures = state.fixtures.filter((fixture) => !dropped.has(fixture.id))
  state.matches = state.matches.filter((match) => !match.fixtureId || !dropped.has(match.fixtureId))
  state.week = regionalPlayoffConfig(phase).regularStart
  state.inbox.unshift(
    `${phase} was restarted with the new format: two groups of six, five group matches each.`,
  )
}
// Browsers cap localStorage at about 5 MB per site, and a full box score costs
// about 5 KB per series, so only recent and managed-team matches keep round logs
// and player stats. Older seasons are dropped entirely.
const DETAILED_MATCH_LIMIT = 120
const HISTORY_SEASONS = 2
const INBOX_LIMIT = 200
const TRANSFER_LIMIT = 600
const stripMatchDetail = (match: MatchResult): MatchResult =>
  match.maps.every((map) => !map.rounds.length && !Object.keys(map.stats).length)
    ? match
    : { ...match, maps: match.maps.map((map) => ({ ...map, rounds: [], stats: {} })) }
export function hasMatchDetail(match: MatchResult) {
  return match.maps.some((map) => Object.keys(map.stats).length > 0)
}
export function pruneHistory(
  state: GameState,
  { detailedMatches = DETAILED_MATCH_LIMIT, seasons = HISTORY_SEASONS } = {},
) {
  const oldestSeason = state.season - seasons + 1
  const involvesManaged = (match: MatchResult) =>
    match.aId === state.currentTeamId || match.bId === state.currentTeamId
  state.matches = state.matches
    .filter((match) => match.season >= oldestSeason)
    .map((match, index) =>
      index < detailedMatches || (match.season === state.season && involvesManaged(match))
        ? match
        : stripMatchDetail(match),
    )
  state.fixtures = state.fixtures.filter((fixture) => fixture.season >= oldestSeason)
  state.inbox = state.inbox.slice(0, INBOX_LIMIT)
  state.transfers = state.transfers
    .filter((transfer) => transfer.season >= oldestSeason)
    .slice(0, TRANSFER_LIMIT)
  return state
}
const isQuotaError = (error: unknown) =>
  error instanceof DOMException &&
  (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
export function saveGame(state: GameState): boolean {
  const snapshot = { ...state, saveTimestamp: new Date().toISOString() }
  // Last resort keeps just this season with the latest box scores.
  const attempts = [
    () => pruneHistory({ ...snapshot }),
    () => pruneHistory({ ...snapshot }, { detailedMatches: 20, seasons: 1 }),
    () => pruneHistory({ ...snapshot }, { detailedMatches: 0, seasons: 1 }),
  ]
  for (const attempt of attempts) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(attempt()))
      return true
    } catch (error) {
      if (!isQuotaError(error)) throw error
    }
  }
  console.warn('Save skipped: browser storage is full.')
  return false
}
export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? migrateGame(JSON.parse(raw)) : null
  } catch {
    return null
  }
}
export function resetGame() {
  localStorage.removeItem(SAVE_KEY)
}
export function currentTeam(state: GameState) {
  return state.teams[state.currentTeamId]
}
export function teamPlayers(state: GameState, teamId = state.currentTeamId) {
  return state.teams[teamId].playerIds.map((id) => state.players[id]).filter(Boolean)
}
export function teamStrength(state: GameState, teamId: string) {
  const team = state.teams[teamId]
  const players = team.lineup.map((id) => state.players[id]).filter(Boolean)
  if (!players.length) return 45
  const assigned = players.map((player) => assignedRole(team, player))
  return (
    players.reduce(
      (sum, player, index) => sum + roleRating(player, assigned[index]) + conditionBonus(player),
      0,
    ) /
      players.length +
    compositionPenalty(assigned)
  )
}
export function assignedRole(team: Team, player: Player): Role {
  return team.roleAssignments[player.id] ?? player.primaryRole
}

function phaseRound(week: number, phase: CompetitionPhase) {
  const starts: Partial<Record<CompetitionPhase, number>> = {
    Kickoff: 1,
    'Masters 1': 8,
    'Stage 1': 11,
    'Masters 2': 20,
    'Stage 2': 24,
    Champions: 36,
  }
  return week - (starts[phase] ?? week) + 1
}
function kickoffSecondRoundPairs(state: GameState, region: Region): Array<[string, string]> {
  const roundOne = state.fixtures
    .filter(
      (fixture) =>
        fixture.season === state.season &&
        fixture.phase === 'Kickoff' &&
        fixture.region === region &&
        fixture.label === 'Upper Round 1' &&
        fixture.status === 'completed',
    )
    .sort((left, right) => left.id.localeCompare(right.id))
  const byes = Object.values(state.teams)
    .filter(
      (team) =>
        team.region === region &&
        state.kickoff[team.id].status === 'active' &&
        state.kickoff[team.id].openingBye,
    )
    .map((team) => team.id)
  const winners = roundOne.map(resultWinner).filter((id): id is string => Boolean(id))
  if (byes.length !== 4 || winners.length !== 4) return []
  return byes.map((teamId, index) => [teamId, winners[index]])
}
function regionalRoundRobin(teamIds: string[], round: number) {
  const ids = [...teamIds]
  if (ids.length % 2) ids.push('')
  const fixed = ids[0],
    rotating = ids.slice(1),
    shift = (round - 1) % rotating.length
  const arranged = [fixed, ...rotating.slice(shift), ...rotating.slice(0, shift)]
  const pairs: Array<[string, string]> = []
  for (let index = 0; index < arranged.length / 2; index++) {
    const a = arranged[index],
      b = arranged[arranged.length - 1 - index]
    if (a && b) pairs.push([a, b])
  }
  return pairs
}
type RegionalPlayoffConfig = {
  regularStart: number
  regularEnd: number
  playoffStart: number
  playoffEnd: number
  playoffTeams: number
  qualifiers: number
}
function regionalPlayoffConfig(phase: 'Stage 1' | 'Stage 2'): RegionalPlayoffConfig {
  return phase === 'Stage 1'
    ? {
        regularStart: 11,
        regularEnd: 15,
        playoffStart: 16,
        playoffEnd: 18,
        playoffTeams: 8,
        qualifiers: 3,
      }
    : {
        regularStart: 24,
        regularEnd: 28,
        playoffStart: 29,
        playoffEnd: 31,
        playoffTeams: 8,
        qualifiers: 4,
      }
}
function regionalPlayoffPhase(phase: string) {
  return phase === 'Stage 1' || phase === 'Stage 2'
}
export function competitionRecord(state: GameState, teamId: string, phase: string) {
  let wins = 0,
    losses = 0,
    mapWins = 0,
    mapLosses = 0
  state.matches
    .filter((match) => {
      const fixture = match.fixtureId
        ? state.fixtures.find((candidate) => candidate.id === match.fixtureId)
        : undefined
      return (
        match.season === state.season &&
        match.phase.startsWith(phase) &&
        (match.aId === teamId || match.bId === teamId) &&
        ((phase !== 'Stage 1' && phase !== 'Stage 2') || !fixture || fixture.stage === 'League')
      )
    })
    .forEach((match) => {
      if (match.winnerId === teamId) wins++
      else losses++
      const isA = match.aId === teamId
      mapWins += isA ? match.aScore : match.bScore
      mapLosses += isA ? match.bScore : match.aScore
    })
  return { wins, losses, mapWins, mapLosses }
}
export function rankedTeams(state: GameState, teamIds: string[], phase: string) {
  return [...teamIds].sort((a, b) => {
    const ar = competitionRecord(state, a, phase),
      br = competitionRecord(state, b, phase)
    return (
      br.wins - ar.wins ||
      ar.losses - br.losses ||
      br.mapWins - br.mapLosses - (ar.mapWins - ar.mapLosses) ||
      state.teams[b].championshipPoints - state.teams[a].championshipPoints
    )
  })
}
export function regionalPlayoffOrder(
  state: GameState,
  phase: 'Stage 1' | 'Stage 2',
  region: Region,
) {
  const ids = Object.values(state.teams)
    .filter((team) => team.region === region)
    .map((team) => team.id)
  const playoff = state.fixtures.filter(
    (fixture) =>
      fixture.season === state.season &&
      fixture.phase === phase &&
      fixture.region === region &&
      fixture.stage === 'Playoffs',
  )
  const ordered: string[] = []
  const push = (id: string | undefined) => {
    if (id && !ordered.includes(id)) ordered.push(id)
  }
  const grandFinal = playoff.find((fixture) => fixture.label === 'Grand Final')
  const lowerFinal = playoff.find((fixture) => fixture.label === 'Lower Final')
  if (grandFinal?.status === 'completed') {
    push(grandFinal.winnerId)
    push(resultLoser(grandFinal))
  }
  if (lowerFinal?.status === 'completed') {
    push(lowerFinal.winnerId)
    push(resultLoser(lowerFinal))
  }
  // Earlier lower-bracket exits finish below the lower final, latest round first.
  if (ordered.length === 4)
    for (const label of ['Lower Round 3', 'Lower Round 2', 'Lower Round 1']) {
      const losers = playoff
        .filter((fixture) => fixture.label === label && fixture.status === 'completed')
        .map(resultLoser)
        .filter((id): id is string => Boolean(id))
      rankedTeams(state, losers, phase).forEach(push)
    }
  return [
    ...ordered,
    ...stagePlayoffSeeds(state, phase, region),
    ...rankedTeams(state, ids, phase),
  ].filter((id, index, list) => list.indexOf(id) === index)
}
/** Kickoff finishing order: the three qualifiers, then teams by how late they were knocked out. */
export function kickoffStandings(state: GameState, region: Region) {
  const ids = Object.values(state.teams)
    .filter((team) => team.region === region)
    .map((team) => team.id)
  const lastMatch = (id: string) =>
    Math.max(
      0,
      ...state.fixtures
        .filter(
          (fixture) =>
            fixture.season === state.season &&
            fixture.phase === 'Kickoff' &&
            fixture.bId &&
            fixture.status === 'completed' &&
            (fixture.aId === id || fixture.bId === id),
        )
        .map((fixture) => fixture.week * 10 + fixture.round),
    )
  const qualified = (id: string) => (state.kickoff[id]?.status === 'qualified' ? 1 : 0)
  return [...ids].sort(
    (a, b) =>
      qualified(b) - qualified(a) ||
      (qualified(a) ? 0 : lastMatch(b) - lastMatch(a)) ||
      (state.kickoff[b]?.wins ?? 0) - (state.kickoff[a]?.wins ?? 0) ||
      (state.kickoff[a]?.losses ?? 0) - (state.kickoff[b]?.losses ?? 0) ||
      state.teams[b].championshipPoints - state.teams[a].championshipPoints,
  )
}
/**
 * Stage groups are drawn in tiers of two from the previous event's finishing
 * order (Kickoff for Stage 1, Stage 1 playoffs for Stage 2): one team from
 * each tier goes to each group at random.
 */
function drawStageGroups(state: GameState, phase: 'Stage 1' | 'Stage 2', region: Region) {
  const seeding =
    phase === 'Stage 1'
      ? kickoffStandings(state, region)
      : regionalPlayoffOrder(state, 'Stage 1', region)
  const groups: Record<'A' | 'B', string[]> = { A: [], B: [] }
  for (let index = 0; index < seeding.length; index += 2) {
    const tier = seeding.slice(index, index + 2)
    if (tier.length === 2 && random(state) < 0.5) tier.reverse()
    groups.A.push(tier[0])
    if (tier[1]) groups.B.push(tier[1])
  }
  return groups
}
/** The drawn Stage groups for a region, or null before the draw (or for legacy leagues). */
export function stageGroups(state: GameState, phase: 'Stage 1' | 'Stage 2', region: Region) {
  const league = state.fixtures.filter(
    (fixture) =>
      fixture.season === state.season &&
      fixture.phase === phase &&
      fixture.region === region &&
      fixture.stage === 'League' &&
      fixture.group,
  )
  if (!league.length) return null
  const members = (group: 'A' | 'B') => [
    ...new Set(
      league
        .filter((fixture) => fixture.group === group)
        .flatMap((fixture) => [fixture.aId, fixture.bId!]),
    ),
  ]
  return { A: members('A'), B: members('B') }
}
/**
 * Playoff seeds from the groups: the top four of each group advance. The
 * better group winner is seed 1, and seeds alternate groups so quarterfinals
 * are always cross-group (A2 v B3, B2 v A3).
 */
export function stagePlayoffSeeds(state: GameState, phase: 'Stage 1' | 'Stage 2', region: Region) {
  const groups = stageGroups(state, phase, region)
  if (!groups)
    return rankedTeams(
      state,
      Object.values(state.teams)
        .filter((team) => team.region === region)
        .map((team) => team.id),
      phase,
    ).slice(0, regionalPlayoffConfig(phase).playoffTeams)
  let first = rankedTeams(state, groups.A, phase),
    second = rankedTeams(state, groups.B, phase)
  if (rankedTeams(state, [first[0], second[0]], phase)[0] !== first[0])
    [first, second] = [second, first]
  return [0, 1, 2, 3].flatMap((place) => [first[place], second[place]]).filter(Boolean)
}
function scheduleStageGroups(state: GameState, phase: 'Stage 1' | 'Stage 2') {
  const config = regionalPlayoffConfig(phase)
  regions.forEach((region) => {
    const groups = drawStageGroups(state, phase, region)
    ;(['A', 'B'] as const).forEach((group, groupIndex) => {
      const ids = groups[group]
      for (let round = 1; round < ids.length + (ids.length % 2); round++) {
        const week = config.regularStart + round - 1
        regionalRoundRobin(ids, round).forEach(([aId, bId], index) => {
          state.fixtures.push({
            id: `${state.season}-${fixtureId(phase, week, region, groupIndex * 10 + index)}`,
            season: state.season,
            week,
            phase,
            scope: 'regional',
            region,
            round,
            label: `Week ${round}`,
            aId,
            bId,
            bestOf: 3,
            status: 'scheduled',
            stage: 'League',
            group,
          })
        })
      }
    })
  })
}
export function regionalPlayoffQualifiers(
  state: GameState,
  phase: 'Stage 1' | 'Stage 2',
  region: Region,
  count = regionalPlayoffConfig(phase).qualifiers,
) {
  return regionalPlayoffOrder(state, phase, region).slice(0, count)
}
function resultWinner(fixture: Fixture) {
  return fixture.winnerId
}
function resultLoser(fixture: Fixture) {
  if (!fixture.bId || !fixture.winnerId) return undefined
  return fixture.winnerId === fixture.aId ? fixture.bId : fixture.aId
}
function pairPool(state: GameState, teamIds: string[]) {
  const pool = [...teamIds],
    pairs: Array<[string, string]> = []
  while (pool.length > 1) {
    const aId = pool.shift()!
    let index = pool.findIndex((id) => state.teams[id].region !== state.teams[aId].region)
    if (index < 0) index = 0
    pairs.push([aId, pool.splice(index, 1)[0]])
  }
  return pairs
}
function addInternationalFixtures(
  state: GameState,
  phase: 'Masters 1' | 'Masters 2' | 'Champions',
  week: number,
  label: string,
  pairs: Array<[string, string]>,
  options: {
    stage: 'Swiss' | 'Groups' | 'Playoffs'
    bracket: 'Swiss' | 'Group' | 'Upper' | 'Lower' | 'Final'
    round: number
    group?: 'A' | 'B' | 'C' | 'D'
    bestOf?: 3 | 5
  },
) {
  pairs.forEach(([aId, bId], index) =>
    state.fixtures.push({
      id: `${state.season}-${fixtureId(phase, week, undefined, state.fixtures.length, `-${label.toLowerCase().replaceAll(' ', '-')}-${index}`)}`,
      season: state.season,
      week,
      phase,
      scope: 'international',
      round: options.round,
      label,
      aId,
      bId,
      bestOf: options.bestOf ?? 3,
      status: 'scheduled',
      stage: options.stage,
      bracket: options.bracket,
      group: options.group,
    }),
  )
}
function addRegionalFixtures(
  state: GameState,
  phase: 'Stage 1' | 'Stage 2',
  region: Region,
  week: number,
  label: string,
  pairs: Array<[string, string]>,
  options: { bracket: 'Upper' | 'Lower' | 'Final'; round: number; bestOf?: 3 | 5 },
) {
  pairs.forEach(([aId, bId], index) =>
    state.fixtures.push({
      id:
        state.season +
        '-' +
        fixtureId(
          phase,
          week,
          region,
          state.fixtures.length,
          '-' + label.toLowerCase().replaceAll(' ', '-') + '-' + index,
        ),
      season: state.season,
      week,
      phase,
      scope: 'regional',
      region,
      round: options.round,
      label,
      aId,
      bId,
      bestOf: options.bestOf ?? 3,
      status: 'scheduled',
      stage: 'Playoffs',
      bracket: options.bracket,
    }),
  )
}
function addKickoffFixtures(
  state: GameState,
  region: Region,
  week: number,
  round: number,
  label: string,
  pairs: Array<[string, string | null]>,
  bestOf: 3 | 5 = 3,
) {
  pairs.forEach(([aId, bId], index) =>
    state.fixtures.push({
      id: `${state.season}-${fixtureId('Kickoff', week, region, state.fixtures.length, `-${label.toLowerCase().replaceAll(' ', '-')}-${index}`)}`,
      season: state.season,
      week,
      phase: 'Kickoff',
      scope: 'regional',
      region,
      round,
      label: bId ? label : label + ' bye',
      aId,
      bId,
      bestOf,
      status: bId ? 'scheduled' : 'completed',
      winnerId: bId ? undefined : aId,
    }),
  )
}
function adjacentKickoffPairs(ids: string[]): Array<[string, string | null]> {
  const pairs: Array<[string, string | null]> = []
  for (let index = 0; index < ids.length; index += 2)
    pairs.push([ids[index], ids[index + 1] ?? null])
  return pairs
}
function mastersEntrants(state: GameState, phase: 'Masters 1' | 'Masters 2') {
  const source = phase === 'Masters 1' ? 'Kickoff' : 'Stage 1'
  const seeded = regions.map((region) => {
    const ids = Object.values(state.teams)
      .filter((team) => team.region === region)
      .map((team) => team.id)
    if (source === 'Kickoff') {
      const qualified = ids.filter((id) => state.kickoff[id].status === 'qualified')
      if (qualified.length === 3)
        return qualified.sort(
          (a, b) =>
            state.kickoff[b].wins - state.kickoff[a].wins ||
            state.kickoff[a].losses - state.kickoff[b].losses,
        )
    }
    if (source === 'Stage 1') return regionalPlayoffQualifiers(state, 'Stage 1', region, 3)
    return rankedTeams(state, ids, source).slice(0, 3)
  })
  return { direct: seeded.map((ids) => ids[0]), swiss: seeded.flatMap((ids) => ids.slice(1, 3)) }
}
function swissRecord(state: GameState, phase: 'Masters 1' | 'Masters 2', teamId: string) {
  const fixtures = state.fixtures.filter(
    (f) =>
      f.season === state.season &&
      f.phase === phase &&
      f.stage === 'Swiss' &&
      f.status === 'completed' &&
      (f.aId === teamId || f.bId === teamId),
  )
  return {
    wins: fixtures.filter((f) => f.winnerId === teamId).length,
    losses: fixtures.filter((f) => resultLoser(f) === teamId).length,
  }
}
function mastersWeek(state: GameState, phase: 'Masters 1' | 'Masters 2', week: number) {
  const start = phase === 'Masters 1' ? 8 : 20,
    end = start + 2,
    { direct, swiss } = mastersEntrants(state, phase)
  if (week === start) {
    addInternationalFixtures(state, phase, week, 'Swiss Opening', pairPool(state, swiss), {
      stage: 'Swiss',
      bracket: 'Swiss',
      round: 1,
    })
    return
  }
  if (week === start + 1) {
    const opening = state.fixtures.filter(
      (f) =>
        f.season === state.season &&
        f.phase === phase &&
        f.label === 'Swiss Opening' &&
        f.status === 'completed',
    )
    addInternationalFixtures(
      state,
      phase,
      week,
      'Swiss Advancement',
      pairPool(state, opening.map(resultWinner).filter(Boolean) as string[]),
      { stage: 'Swiss', bracket: 'Swiss', round: 2 },
    )
    addInternationalFixtures(
      state,
      phase,
      week,
      'Swiss Elimination',
      pairPool(state, opening.map(resultLoser).filter(Boolean) as string[]),
      { stage: 'Swiss', bracket: 'Swiss', round: 2 },
    )
    return
  }
  if (week === end) {
    const advanced = swiss.filter((id) => swissRecord(state, phase, id).wins >= 2)
    const orderedSwiss = rankedTeams(state, advanced, phase)
    const pairs = direct.map(
      (id, index) => [id, orderedSwiss[(index + 1) % orderedSwiss.length]] as [string, string],
    )
    addInternationalFixtures(state, phase, week, 'Upper Quarterfinal', pairs, {
      stage: 'Playoffs',
      bracket: 'Upper',
      round: 1,
    })
  }
}
function championsGroups(state: GameState) {
  const regionSeeds = regions.map((region) =>
    regionalPlayoffQualifiers(state, 'Stage 2', region, 4),
  )
  return (['A', 'B', 'C', 'D'] as const).map((name, index) => ({
    name,
    ids: regions.map((_, regionIndex) => regionSeeds[regionIndex][(index + regionIndex) % 4]),
  }))
}
/**
 * Champions fixtures for this season with one label, in scheduling order.
 * Past seasons keep their fixtures, so every lookup must be season-scoped.
 */
function championsFixtures(state: GameState, label: string) {
  return state.fixtures.filter(
    (f) => f.season === state.season && f.phase === 'Champions' && f.label === label,
  )
}
const championsGroupNames = ['A', 'B', 'C', 'D'] as const
/**
 * Each Champions group is a four-team GSL bracket: two openers, a winners'
 * match (winner qualifies as group winner), an elimination match (loser is
 * out), and a decider between the winners' match loser and the elimination
 * match winner for second place.
 */
function championsWeek(state: GameState, week: number) {
  const group = (name: string, stage: string) =>
    championsFixtures(state, `Group ${name} · ${stage}`)
  if (week === 36) {
    championsGroups(state).forEach((drawn) =>
      addInternationalFixtures(
        state,
        'Champions',
        week,
        `Group ${drawn.name} · Opening`,
        [
          [drawn.ids[0], drawn.ids[3]],
          [drawn.ids[1], drawn.ids[2]],
        ],
        { stage: 'Groups', bracket: 'Group', group: drawn.name, round: 1 },
      ),
    )
    return
  }
  if (week === 37) {
    championsGroupNames.forEach((name) => {
      const opening = group(name, 'Opening')
      addInternationalFixtures(
        state,
        'Champions',
        week,
        `Group ${name} · Winners`,
        [[resultWinner(opening[0])!, resultWinner(opening[1])!]],
        { stage: 'Groups', bracket: 'Group', group: name, round: 2 },
      )
      addInternationalFixtures(
        state,
        'Champions',
        week,
        `Group ${name} · Elimination`,
        [[resultLoser(opening[0])!, resultLoser(opening[1])!]],
        { stage: 'Groups', bracket: 'Group', group: name, round: 2 },
      )
    })
    return
  }
  if (week === 38) {
    championsGroupNames.forEach((name) => {
      const [winners] = group(name, 'Winners'),
        [elimination] = group(name, 'Elimination')
      addInternationalFixtures(
        state,
        'Champions',
        week,
        `Group ${name} · Decider`,
        [[resultLoser(winners)!, resultWinner(elimination)!]],
        { stage: 'Groups', bracket: 'Group', group: name, round: 3 },
      )
    })
    return
  }
  if (week === 39) {
    const qualified = championsGroupNames.map((name) => ({
      winner: resultWinner(group(name, 'Winners')[0])!,
      runner: resultWinner(group(name, 'Decider')[0])!,
    }))
    addInternationalFixtures(
      state,
      'Champions',
      week,
      'Upper Quarterfinal',
      [
        [qualified[0].winner, qualified[1].runner],
        [qualified[1].winner, qualified[0].runner],
        [qualified[2].winner, qualified[3].runner],
        [qualified[3].winner, qualified[2].runner],
      ],
      { stage: 'Playoffs', bracket: 'Upper', round: 1 },
    )
    return
  }
  const qf = championsFixtures(state, 'Upper Quarterfinal')
  if (week === 40) {
    addInternationalFixtures(
      state,
      'Champions',
      week,
      'Upper Semifinal',
      [
        [resultWinner(qf[0])!, resultWinner(qf[1])!],
        [resultWinner(qf[2])!, resultWinner(qf[3])!],
      ],
      { stage: 'Playoffs', bracket: 'Upper', round: 2 },
    )
    addInternationalFixtures(
      state,
      'Champions',
      week,
      'Lower Round 1',
      [
        [resultLoser(qf[0])!, resultLoser(qf[1])!],
        [resultLoser(qf[2])!, resultLoser(qf[3])!],
      ],
      { stage: 'Playoffs', bracket: 'Lower', round: 2 },
    )
    return
  }
  const upperSemis = championsFixtures(state, 'Upper Semifinal'),
    lowerOne = championsFixtures(state, 'Lower Round 1')
  if (week === 41) {
    addInternationalFixtures(
      state,
      'Champions',
      week,
      'Upper Final',
      [[resultWinner(upperSemis[0])!, resultWinner(upperSemis[1])!]],
      { stage: 'Playoffs', bracket: 'Upper', round: 3 },
    )
    addInternationalFixtures(
      state,
      'Champions',
      week,
      'Lower Round 2',
      [
        [resultLoser(upperSemis[0])!, resultWinner(lowerOne[1])!],
        [resultLoser(upperSemis[1])!, resultWinner(lowerOne[0])!],
      ],
      { stage: 'Playoffs', bracket: 'Lower', round: 3 },
    )
    return
  }
  if (week === 42) {
    const [upperFinal] = championsFixtures(state, 'Upper Final'),
      [lowerThree] = championsFixtures(state, 'Lower Round 3')
    addInternationalFixtures(
      state,
      'Champions',
      week,
      'Lower Final',
      [[resultLoser(upperFinal)!, resultWinner(lowerThree)!]],
      { stage: 'Playoffs', bracket: 'Lower', round: 5, bestOf: 5 },
    )
  }
}
function regionalFixtures(
  state: GameState,
  phase: 'Stage 1' | 'Stage 2',
  region: Region,
  label: string,
) {
  return state.fixtures.filter(
    (fixture) =>
      fixture.season === state.season &&
      fixture.phase === phase &&
      fixture.region === region &&
      fixture.label === label,
  )
}
function scheduleRegionalPlayoffWeek(state: GameState, phase: 'Stage 1' | 'Stage 2', week: number) {
  const config = regionalPlayoffConfig(phase)
  regions.forEach((region) => {
    const ids = stagePlayoffSeeds(state, phase, region)
    if (ids.length < config.playoffTeams) return
    if (week === config.playoffStart) {
      addRegionalFixtures(
        state,
        phase,
        region,
        week,
        'Upper Quarterfinal',
        [
          [ids[2], ids[5]],
          [ids[3], ids[4]],
        ],
        { bracket: 'Upper', round: 1 },
      )
    }
    if (week === config.playoffStart + 1) {
      const qf = regionalFixtures(state, phase, region, 'Upper Quarterfinal').sort((left, right) =>
        left.id.localeCompare(right.id),
      )
      if (
        qf.length === 2 &&
        qf.every((fixture) => fixture.status === 'completed') &&
        !regionalFixtures(state, phase, region, 'Upper Semifinal').length
      ) {
        addRegionalFixtures(
          state,
          phase,
          region,
          week,
          'Upper Semifinal',
          [
            [ids[0], resultWinner(qf[1])!],
            [ids[1], resultWinner(qf[0])!],
          ],
          { bracket: 'Upper', round: 2 },
        )
        addRegionalFixtures(
          state,
          phase,
          region,
          week,
          'Lower Round 1',
          [
            [ids[7], resultLoser(qf[0])!],
            [ids[6], resultLoser(qf[1])!],
          ],
          { bracket: 'Lower', round: 2 },
        )
      }
    }
    if (week === config.playoffStart + 2) {
      const upperFinal = regionalFixtures(state, phase, region, 'Upper Final')[0]
      const lowerThree = regionalFixtures(state, phase, region, 'Lower Round 3')[0]
      if (
        upperFinal?.status === 'completed' &&
        lowerThree?.status === 'completed' &&
        !regionalFixtures(state, phase, region, 'Lower Final').length
      ) {
        addRegionalFixtures(
          state,
          phase,
          region,
          week,
          'Lower Final',
          [[resultLoser(upperFinal)!, resultWinner(lowerThree)!]],
          { bracket: 'Lower', round: 5, bestOf: 5 },
        )
      }
    }
  })
}
function awardRegionalPlayoffQualifiers(
  state: GameState,
  phase: 'Stage 1' | 'Stage 2',
  region: Region,
) {
  const config = regionalPlayoffConfig(phase)
  const prefix = phase === 'Stage 1' ? 'Masters 2 qualifier #' : 'Champions qualifier #'
  if (
    Object.values(state.teams).some(
      (team) => team.region === region && team.playoffStage.startsWith(prefix),
    )
  )
    return
  regionalPlayoffQualifiers(state, phase, region, config.qualifiers).forEach((id, index) => {
    state.teams[id].playoffStage = prefix + (index + 1)
    state.teams[id].championshipPoints += phase === 'Stage 1' ? 3 : 5
  })
}
function finishRegionalWeek(
  state: GameState,
  phase: 'Stage 1' | 'Stage 2',
  week: number,
  attackStyle: string,
  defenseStyle: string,
  autoPlay = true,
) {
  const config = regionalPlayoffConfig(phase)
  let managed: MatchResult | null = null
  const remember = (result: MatchResult | null) => {
    if (result && (result.aId === state.currentTeamId || result.bId === state.currentTeamId))
      managed = result
  }
  const playNew = (fixtures: Fixture[]) => {
    if (!autoPlay) return
    fixtures
      .filter((fixture) => fixture.status === 'scheduled')
      .forEach((fixture) => remember(playFixture(state, fixture, attackStyle, defenseStyle)))
  }
  const completed = (region: Region, label: string) =>
    regionalFixtures(state, phase, region, label).filter(
      (fixture) => fixture.status === 'completed',
    )
  if (week === config.playoffStart + 1) {
    regions.forEach((region) => {
      const semis = completed(region, 'Upper Semifinal')
      const lowerOne = completed(region, 'Lower Round 1')
      if (
        semis.length === 2 &&
        lowerOne.length === 2 &&
        !regionalFixtures(state, phase, region, 'Upper Final').length
      ) {
        addRegionalFixtures(
          state,
          phase,
          region,
          week,
          'Upper Final',
          [[resultWinner(semis[0])!, resultWinner(semis[1])!]],
          { bracket: 'Upper', round: 3 },
        )
        addRegionalFixtures(
          state,
          phase,
          region,
          week,
          'Lower Round 2',
          [
            [resultLoser(semis[0])!, resultWinner(lowerOne[0])!],
            [resultLoser(semis[1])!, resultWinner(lowerOne[1])!],
          ],
          { bracket: 'Lower', round: 3 },
        )
        playNew([
          ...regionalFixtures(state, phase, region, 'Upper Final'),
          ...regionalFixtures(state, phase, region, 'Lower Round 2'),
        ])
      }
      if (
        completed(region, 'Upper Final').length !== 1 ||
        completed(region, 'Lower Round 2').length !== 2
      )
        return
      if (!regionalFixtures(state, phase, region, 'Lower Round 3').length) {
        const lowerTwo = completed(region, 'Lower Round 2')
        addRegionalFixtures(
          state,
          phase,
          region,
          week,
          'Lower Round 3',
          [[resultWinner(lowerTwo[0])!, resultWinner(lowerTwo[1])!]],
          { bracket: 'Lower', round: 4 },
        )
        playNew(regionalFixtures(state, phase, region, 'Lower Round 3'))
      }
    })
  }
  if (week === config.playoffStart + 2) {
    regions.forEach((region) => {
      const lowerFinal = completed(region, 'Lower Final')[0]
      const upperFinal = completed(region, 'Upper Final')[0]
      if (
        lowerFinal &&
        upperFinal &&
        !regionalFixtures(state, phase, region, 'Grand Final').length
      ) {
        addRegionalFixtures(
          state,
          phase,
          region,
          week,
          'Grand Final',
          [[resultWinner(upperFinal)!, resultWinner(lowerFinal)!]],
          { bracket: 'Final', round: 6, bestOf: 5 },
        )
        playNew(regionalFixtures(state, phase, region, 'Grand Final'))
      }
      if (completed(region, 'Grand Final').length === 1)
        awardRegionalPlayoffQualifiers(state, phase, region)
    })
  }
  return managed
}
function scheduleInternationalWeek(
  state: GameState,
  phase: 'Masters 1' | 'Masters 2' | 'Champions',
  week: number,
) {
  if (phase === 'Champions') championsWeek(state, week)
  else mastersWeek(state, phase, week)
}
function fixtureId(
  phase: string,
  week: number,
  region: Region | undefined,
  index: number,
  suffix = '',
) {
  return `${phase.toLowerCase().replaceAll(' ', '-')}-w${week}-${region ?? 'global'}-${index}${suffix}`
}
export function ensureWeekScheduled(state: GameState, week = state.week) {
  if (state.fixtures.some((f) => f.season === state.season && f.week === week)) return
  const phase = phaseForWeek(week)
  if (phase === 'Break' || phase === 'Offseason') return
  const round = phaseRound(week, phase)

  if (phase === 'Kickoff') {
    regions.forEach((region) => {
      const active = Object.values(state.teams)
        .filter((team) => team.region === region && state.kickoff[team.id]?.status === 'active')
        .map((team) => team.id)
      const completed = (label: string) =>
        state.fixtures
          .filter(
            (fixture) =>
              fixture.season === state.season &&
              fixture.phase === 'Kickoff' &&
              fixture.region === region &&
              fixture.label === label &&
              fixture.status === 'completed',
          )
          .sort((left, right) => left.id.localeCompare(right.id))
      const winners = (label: string) =>
        completed(label)
          .map(resultWinner)
          .filter((id): id is string => Boolean(id))
      const losers = (label: string) =>
        completed(label)
          .map(resultLoser)
          .filter((id): id is string => Boolean(id))
      if (round === 1) {
        addKickoffFixtures(
          state,
          region,
          week,
          1,
          'Upper Round 1',
          adjacentKickoffPairs(active.filter((id) => !state.kickoff[id].openingBye)),
        )
        return
      }
      if (round === 2) {
        addKickoffFixtures(
          state,
          region,
          week,
          2,
          'Upper Round 2',
          kickoffSecondRoundPairs(state, region),
        )
        return
      }
      if (round === 3) {
        const upperOneLosers = losers('Upper Round 1')
        const upperTwoLosers = losers('Upper Round 2')
        if (completed('Upper Round 2').length === 4 && upperOneLosers.length === 4) {
          addKickoffFixtures(
            state,
            region,
            week,
            3,
            'Upper Round 3',
            adjacentKickoffPairs(winners('Upper Round 2')),
          )
          addKickoffFixtures(
            state,
            region,
            week,
            3,
            'Middle Round 1',
            upperOneLosers.map((teamId, index) => [
              teamId,
              upperTwoLosers[upperTwoLosers.length - 1 - index],
            ]),
          )
        }
        return
      }
      if (round === 4) {
        if (completed('Upper Round 3').length === 2 && completed('Middle Round 1').length === 4) {
          addKickoffFixtures(
            state,
            region,
            week,
            4,
            'Upper Final',
            [[winners('Upper Round 3')[0], winners('Upper Round 3')[1]]],
            5,
          )
          addKickoffFixtures(
            state,
            region,
            week,
            4,
            'Middle Round 2',
            adjacentKickoffPairs(winners('Middle Round 1')),
          )
          addKickoffFixtures(
            state,
            region,
            week,
            4,
            'Lower Round 1',
            adjacentKickoffPairs(losers('Middle Round 1')),
          )
        }
        return
      }
      if (round === 5) {
        if (
          completed('Upper Final').length === 1 &&
          completed('Middle Round 2').length === 2 &&
          completed('Lower Round 1').length === 2
        ) {
          addKickoffFixtures(
            state,
            region,
            week,
            5,
            'Middle Round 3',
            losers('Upper Round 3').map((teamId, index) => [
              teamId,
              winners('Middle Round 2')[index],
            ]),
          )
          addKickoffFixtures(
            state,
            region,
            week,
            5,
            'Lower Round 2',
            losers('Middle Round 2').map((teamId, index) => [
              teamId,
              winners('Lower Round 1')[1 - index],
            ]),
          )
        }
        return
      }
      if (round === 6) {
        if (completed('Middle Round 3').length === 2 && completed('Lower Round 2').length === 2) {
          addKickoffFixtures(
            state,
            region,
            week,
            6,
            'Middle Round 4',
            adjacentKickoffPairs(winners('Middle Round 3')),
          )
          addKickoffFixtures(
            state,
            region,
            week,
            6,
            'Lower Round 3',
            losers('Middle Round 3').map((teamId, index) => [
              teamId,
              winners('Lower Round 2')[1 - index],
            ]),
          )
        }
      }
    })
    return
  }

  if (phase === 'Stage 1' || phase === 'Stage 2') {
    const config = regionalPlayoffConfig(phase)
    // The whole group stage is drawn and scheduled on its first week.
    if (week === config.regularStart) scheduleStageGroups(state, phase)
    if (week > config.regularEnd) scheduleRegionalPlayoffWeek(state, phase, week)
    return
  }

  if (phase === 'Masters 1' || phase === 'Masters 2' || phase === 'Champions') {
    scheduleInternationalWeek(state, phase, week)
  }
}
export function fixturesForWeek(state: GameState, week = state.week) {
  return state.fixtures.filter(
    (fixture) => fixture.season === state.season && fixture.week === week,
  )
}
export function nextFixtureForTeam(
  state: GameState,
  teamId = state.currentTeamId,
  fromWeek = state.week,
) {
  return state.fixtures
    .filter(
      (f) =>
        f.season === state.season &&
        f.status === 'scheduled' &&
        f.week >= fromWeek &&
        (f.aId === teamId || f.bId === teamId),
    )
    .sort((a, b) => a.week - b.week || a.round - b.round)[0]
}

type StatAccumulator = PlayerStat & { kastRounds: number; damage: number }
function blankAccumulator(): StatAccumulator {
  return {
    kills: 0,
    deaths: 0,
    assists: 0,
    acs: 0,
    adr: 0,
    kast: 0,
    firstKills: 0,
    firstDeaths: 0,
    clutches: 0,
    plants: 0,
    defuses: 0,
    headshots: 0,
    kastRounds: 0,
    damage: 0,
  }
}
function weightedPlayer(state: GameState, ids: string[], acc: Record<string, StatAccumulator>) {
  const weights = ids.map((id) => {
    const player = state.players[id]
    return Math.max(
      10,
      player.ratings.Mechanics * 0.55 +
        player.ratings.Consistency * 0.25 +
        player.ratings.Clutch * 0.2 +
        conditionBonus(player) +
        acc[id].kills * 0.8,
    )
  })
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = random(state) * total
  for (let index = 0; index < ids.length; index++) {
    roll -= weights[index]
    if (roll <= 0) return ids[index]
  }
  return ids[ids.length - 1]
}
function victimsForRound(
  state: GameState,
  ids: string[],
  count: number,
  acc: Record<string, StatAccumulator>,
) {
  return [...ids]
    .sort((a, b) => acc[a].deaths - acc[b].deaths || random(state) - 0.5)
    .slice(0, count)
}
function casualtyCount(state: GameState, losingSide: boolean) {
  if (losingSide) return random(state) < 0.9 ? 5 : 4
  const roll = random(state)
  if (roll < 0.08) return 0
  if (roll < 0.25) return 1
  if (roll < 0.53) return 2
  if (roll < 0.82) return 3
  return 4
}

function simulateMap(
  state: GameState,
  aId: string,
  bId: string,
  map: string,
  attackStyle: string,
  defenseStyle: string,
  mapEdge = 0,
): MapResult {
  const a = state.teams[aId],
    b = state.teams[bId]
  const aPower = teamStrength(state, aId) + mapEdge,
    bPower = teamStrength(state, bId)
  const styleBonus =
    (attackStyle === 'Fast and explosive'
      ? 1.5
      : attackStyle === 'Slow information play'
        ? 0.5
        : 0) +
    (defenseStyle === 'Disciplined retakes' ? 1 : defenseStyle === 'Proactive contesting' ? 0.5 : 0)
  const acc: Record<string, StatAccumulator> = {}
  const allIds = [...a.lineup, ...b.lineup]
  allIds.forEach((id) => {
    acc[id] = blankAccumulator()
  })
  let aScore = 0,
    bScore = 0,
    round = 0
  const rounds: string[] = []

  while (round < 60) {
    if (
      (aScore >= 13 || bScore >= 13) &&
      (Math.min(aScore, bScore) < 12 || Math.abs(aScore - bScore) >= 2)
    )
      break
    round++
    const overtime = round > 24
    const aAttacking = overtime ? round % 2 === 1 : round <= 12
    const sideBonus = aAttacking ? attackerEdge(map) : -attackerEdge(map)
    const probability = clamp(
      0.5 + (aPower - bPower) / 115 + styleBonus / 100 + sideBonus,
      0.17,
      0.83,
    )
    const aWins = random(state) < probability
    const winning = aWins ? a : b,
      losing = aWins ? b : a
    const winningDeaths = casualtyCount(state, false),
      losingDeaths = casualtyCount(state, true)
    const winningVictims = victimsForRound(state, winning.lineup, winningDeaths, acc)
    const losingVictims = victimsForRound(state, losing.lineup, losingDeaths, acc)
    const killed = new Set<string>(),
      assisted = new Set<string>(),
      died = new Set<string>()
    const roundKills: Record<string, number> = {}
    const firstFromWinner = random(state) < 0.72

    const registerDeath = (victimId: string, killerTeamIds: string[], first: boolean) => {
      const killerId = weightedPlayer(state, killerTeamIds, acc)
      acc[victimId].deaths++
      acc[killerId].kills++
      acc[killerId].damage += 125 + Math.round(random(state) * 35)
      roundKills[killerId] = (roundKills[killerId] ?? 0) + 1
      killed.add(killerId)
      died.add(victimId)
      if (first) {
        acc[killerId].firstKills++
        acc[victimId].firstDeaths++
      }
      if (random(state) < 0.56) {
        const helpers = killerTeamIds.filter((id) => id !== killerId)
        const assistId = helpers[Math.floor(random(state) * helpers.length)]
        if (assistId) {
          acc[assistId].assists++
          acc[assistId].damage += 28 + Math.round(random(state) * 42)
          assisted.add(assistId)
        }
      }
    }

    const firstWinnerKill = firstFromWinner || winningVictims.length === 0
    const firstVictim = firstWinnerKill ? losingVictims.shift() : winningVictims.shift()
    if (firstVictim)
      registerDeath(firstVictim, firstWinnerKill ? winning.lineup : losing.lineup, true)
    losingVictims.forEach((victimId) => registerDeath(victimId, winning.lineup, false))
    winningVictims.forEach((victimId) => registerDeath(victimId, losing.lineup, false))

    const attackers = aAttacking ? a : b,
      defenders = aAttacking ? b : a
    if (random(state) < 0.76) {
      const planterId = attackers.lineup[Math.floor(random(state) * attackers.lineup.length)]
      acc[planterId].plants++
      if (winning.id === defenders.id && random(state) < 0.7) {
        const defuserId = defenders.lineup[Math.floor(random(state) * defenders.lineup.length)]
        acc[defuserId].defuses++
      }
    }
    if (winningDeaths === 4 && losingDeaths === 5) {
      const survivor = winning.lineup.find((id) => !died.has(id))
      if (survivor) acc[survivor].clutches++
    }
    allIds.forEach((id) => {
      acc[id].damage += Math.round(random(state) * 42)
      if (killed.has(id) || assisted.has(id) || !died.has(id)) acc[id].kastRounds++
    })
    if (aWins) aScore++
    else bScore++
    const star = Object.entries(roundKills).sort(([, left], [, right]) => right - left)[0]
    const starText =
      star && star[1] >= 3
        ? ` · ${state.players[star[0]].name} ${star[1] === 5 ? 'ACE' : `${star[1]}K`}`
        : ''
    rounds.push(
      `${overtime ? 'OT · ' : ''}${winning.short} won round ${round}, ${losingDeaths}-${winningDeaths}${starText}`,
    )
  }

  const totalRounds = aScore + bScore
  const stats: Record<string, PlayerStat> = {}
  allIds.forEach((id) => {
    const x = acc[id],
      player = state.players[id]
    const headshotRate = clamp(
      0.18 + (player.ratings.Mechanics - 55) / 180 + random(state) * 0.08,
      0.16,
      0.48,
    )
    const adr = clamp(Math.round(x.damage / totalRounds), 55, 220)
    const acs = clamp(
      Math.round(
        (x.damage + x.kills * 64 + x.assists * 16 + x.firstKills * 10 + x.clutches * 40) /
          totalRounds,
      ),
      85,
      360,
    )
    stats[id] = {
      kills: x.kills,
      deaths: x.deaths,
      assists: x.assists,
      acs,
      adr,
      kast: clamp(Math.round((x.kastRounds / totalRounds) * 100), 35, 96),
      firstKills: x.firstKills,
      firstDeaths: x.firstDeaths,
      clutches: x.clutches,
      plants: x.plants,
      defuses: x.defuses,
      headshots: Math.min(x.kills, Math.round(x.kills * headshotRate)),
    }
  })
  return { map, aScore, bScore, winnerId: aScore > bScore ? aId : bId, rounds, stats }
}

export function simulateSeries(
  state: GameState,
  aId: string,
  bId: string,
  week: number,
  attackStyle = 'Measured defaults',
  defenseStyle = 'Disciplined retakes',
  bestOf: 3 | 5 = 3,
  fixtureIdValue?: string,
): MatchResult {
  const needed = Math.ceil(bestOf / 2),
    vetoResult = runVeto(state, aId, bId, bestOf, () => random(state)),
    veto = vetoResult.maps,
    mapResults: MapResult[] = []
  let aWins = 0,
    bWins = 0
  while (aWins < needed && bWins < needed) {
    const map = veto[mapResults.length % veto.length]
    const mapResult = simulateMap(
      state,
      aId,
      bId,
      map,
      attackStyle,
      defenseStyle,
      mapFit(state, aId, map) - mapFit(state, bId, map),
    )
    mapResults.push(mapResult)
    if (mapResult.winnerId === aId) aWins++
    else bWins++
  }
  const winnerId = aWins > bWins ? aId : bId,
    a = state.teams[aId],
    b = state.teams[bId]
  a.wins += winnerId === aId ? 1 : 0
  a.losses += winnerId === aId ? 0 : 1
  b.wins += winnerId === bId ? 1 : 0
  b.losses += winnerId === bId ? 0 : 1
  a.mapWins += aWins
  a.mapLosses += bWins
  b.mapWins += bWins
  b.mapLosses += aWins
  state.teams[winnerId].championshipPoints++
  updateFormAndMorale(state, [...a.lineup, ...b.lineup], mapResults, (id) =>
    (winnerId === aId ? a : b).lineup.includes(id),
  )
  const performances = mapResults
    .flatMap((result) =>
      Object.entries(result.stats).map(([playerId, stat]) => ({ playerId, stat, map: result.map })),
    )
    .sort((left, right) => right.stat.acs - left.stat.acs)
  const top = performances[0]
  const aceRound = mapResults
    .flatMap((result) => result.rounds.map((summary) => ({ map: result.map, summary })))
    .find((item) => item.summary.includes('ACE'))
  const highlights = [
    top
      ? `${state.players[top.playerId].name} led the server with ${top.stat.acs} ACS on ${top.map}.`
      : 'The series was decided by team play.',
    `${mapResults[0].map} finished ${mapResults[0].aScore}-${mapResults[0].bScore}.`,
    aceRound
      ? `${aceRound.map}: ${aceRound.summary}.`
      : 'No ace was recorded; the decisive rounds came from coordinated trades.',
  ]
  return {
    id: `${state.season}-${week}-${aId}-${bId}-${state.matches.length}-${state.rng}`,
    fixtureId: fixtureIdValue,
    season: state.season,
    week,
    phase: phaseLabel(week),
    aId,
    bId,
    bestOf,
    winnerId,
    aScore: aWins,
    bScore: bWins,
    maps: mapResults,
    highlights,
    veto,
    vetoLog: describeVeto(state, vetoResult.steps),
    attackStyle,
    defenseStyle,
  }
}

function updateFormAndMorale(
  state: GameState,
  playerIds: string[],
  mapResults: MapResult[],
  won: (id: string) => boolean,
) {
  playerIds.forEach((id) => {
    const player = state.players[id]
    const played = mapResults.map((result) => result.stats[id]).filter(Boolean)
    if (!player || !played.length) return
    const averageAcs = played.reduce((sum, stat) => sum + stat.acs, 0) / played.length
    player.form = formAfterSeries(player.form, averageAcs, won(id))
    player.morale = moraleAfterSeries(player.morale, won(id))
  })
}
function applyKickoffResult(state: GameState, result: MatchResult) {
  const loserId = result.winnerId === result.aId ? result.bId : result.aId
  state.kickoff[result.winnerId].wins++
  state.kickoff[loserId].losses++
  if (state.kickoff[loserId].losses >= 3) {
    state.kickoff[loserId].status = 'eliminated'
    state.teams[loserId].playoffStage = 'Kickoff · eliminated'
  }
}
function playFixture(
  state: GameState,
  fixture: Fixture,
  attackStyle: string,
  defenseStyle: string,
) {
  if (!fixture.bId || fixture.status === 'completed') return null
  const userInvolved = fixture.aId === state.currentTeamId || fixture.bId === state.currentTeamId
  const result = simulateSeries(
    state,
    fixture.aId,
    fixture.bId,
    fixture.week,
    userInvolved ? attackStyle : 'Measured defaults',
    userInvolved ? defenseStyle : 'Disciplined retakes',
    fixture.bestOf,
    fixture.id,
  )
  fixture.status = 'completed'
  fixture.winnerId = result.winnerId
  fixture.resultId = result.id
  state.matches.unshift(result)
  if (fixture.phase === 'Kickoff') applyKickoffResult(state, result)
  return result
}
const tournamentSteps: string[][] = [
  ['Swiss Opening'],
  ['Swiss Advancement', 'Swiss Elimination'],
  ['Swiss Decider'],
  ['Upper Quarterfinal'],
  ['Upper Semifinal', 'Lower Round 1'],
  ['Upper Final', 'Lower Round 2'],
  ['Lower Round 3'],
  ['Lower Final'],
  ['Grand Final'],
]
function liveStepFixtures(scheduled: Fixture[]) {
  if (!scheduled.length) return []
  if (scheduled.every((fixture) => fixture.phase !== 'Kickoff')) {
    const step = tournamentSteps.find((labels) =>
      labels.some((label) => scheduled.some((fixture) => fixture.label === label)),
    )
    if (step) return scheduled.filter((fixture) => step.includes(fixture.label))
  }
  const round = Math.min(...scheduled.map((fixture) => fixture.round))
  return scheduled.filter((fixture) => fixture.round === round)
}
function compareFixtures(left: Fixture, right: Fixture) {
  return (
    left.round - right.round ||
    left.label.localeCompare(right.label) ||
    left.id.localeCompare(right.id)
  )
}
function eventWeekFixtures(
  state: GameState,
  phase: Exclude<CompetitionPhase, 'Break' | 'Offseason'>,
  region?: Region,
) {
  return fixturesForWeek(state, state.week)
    .filter((fixture) => fixture.phase === phase && (!region || fixture.region === region))
    .sort(compareFixtures)
}
export function liveTournamentRoundFixtures(
  state: GameState,
  phase: Exclude<CompetitionPhase, 'Break' | 'Offseason'>,
  region?: Region,
) {
  return liveStepFixtures(
    eventWeekFixtures(state, phase, region).filter((fixture) => fixture.status === 'scheduled'),
  )
}
export function currentTournamentDeskFixtures(
  state: GameState,
  phase: Exclude<CompetitionPhase, 'Break' | 'Offseason'>,
  region?: Region,
) {
  const weekFixtures = eventWeekFixtures(state, phase, region)
  const remaining = liveStepFixtures(
    weekFixtures.filter((fixture) => fixture.status === 'scheduled'),
  )
  if (!remaining.length) return []
  const labels = new Set(remaining.map((fixture) => fixture.label))
  return weekFixtures.filter((fixture) => labels.has(fixture.label))
}
function isPackedTournamentWeek(week: number) {
  const phase = phaseForWeek(week)
  if (phase === 'Kickoff') return week === 6
  if (phase === 'Masters 1') return week === 9 || week === 10
  if (phase === 'Masters 2') return week === 21 || week === 22
  if (phase === 'Champions') return week === 41 || week === 42
  if (phase === 'Stage 1' || phase === 'Stage 2') {
    const start = regionalPlayoffConfig(phase).playoffStart
    return week === start + 1 || week === start + 2
  }
  return false
}
function finalizeCalendarWeek(state: GameState) {
  const managedTeam = currentTeam(state)
  if (state.week % 8 === 0 && managedTeam.wins > managedTeam.losses) {
    const candidate = Object.values(state.teams).find(
      (team) =>
        team.id !== managedTeam.id &&
        team.losses > team.wins &&
        !state.jobs.some((job) => job.teamId === team.id && job.status === 'pending'),
    )
    if (candidate) {
      state.jobs.unshift({
        id: `job-${state.week}`,
        teamId: candidate.id,
        expiresWeek: state.week + 2,
        reason: 'The organization is seeking a new direction after a difficult run.',
        salary: 180000 + candidate.losses * 12000,
        status: 'pending',
      })
      state.inbox.unshift(`${candidate.name} has opened a manager position for you.`)
    }
  }
  runAiTransfers(state)
  state.week++
  if (state.week === OFFSEASON_START_WEEK) warnExpiringContracts(state)
  if (state.week > 52) rolloverSeason(state)
  ensureWeekScheduled(state, state.week)
  pruneHistory(state)
  state.saveTimestamp = new Date().toISOString()
  saveGame(state)
}
const OFFSEASON_START_WEEK = 44
const MIN_ROSTER = 5

export function expiringContracts(state: GameState, teamId = state.currentTeamId) {
  return teamPlayers(state, teamId).filter((player) => player.years <= 1)
}
function warnExpiringContracts(state: GameState) {
  const expiring = expiringContracts(state)
  if (!expiring.length) return
  state.inbox.unshift(
    `Contracts expiring after season ${state.season}: ${expiring.map((player) => player.name).join(', ')}. Players still on contract at rollover leave in free agency unless you need them to field five.`,
  )
}
function renewalYears(player: Player) {
  if (player.age >= 30) return 1
  return player.age <= 23 ? 3 : 2
}
function refillLineup(state: GameState, team: Team) {
  team.lineup = team.lineup.filter((id) => team.playerIds.includes(id))
  team.playerIds
    .filter((id) => !team.lineup.includes(id) && state.players[id].status !== 'inactive')
    .concat(team.playerIds.filter((id) => !team.lineup.includes(id)))
    .forEach((id) => {
      if (team.lineup.length < 5 && !team.lineup.includes(id)) {
        team.lineup.push(id)
        state.players[id].status = 'starter'
      }
    })
  team.lineup.forEach((id) => {
    team.roleAssignments[id] ??= state.players[id].primaryRole
  })
  Object.keys(team.roleAssignments).forEach((id) => {
    if (!team.lineup.includes(id)) delete team.roleAssignments[id]
  })
  if (team.id !== state.currentTeamId) autoAssignRoles(state, team)
}
// AI teams re-slot roles so every core role is covered at the lowest comfort cost.
export function autoAssignRoles(state: GameState, team: Team) {
  team.roleAssignments = bestRoleAssignment(
    team.lineup.map((id) => state.players[id]).filter(Boolean),
  )
}
function resolveExpiredContracts(state: GameState, team: Team) {
  const managed = team.id === state.currentTeamId
  const expired = team.playerIds.filter((id) => state.players[id].years <= 0)
  if (!expired.length) return
  // AI organizations keep their starters; the managed team lets everyone walk.
  // Either way the best expiring players re-sign until the roster can field five.
  const keep = new Set(managed ? [] : expired.filter((id) => team.lineup.includes(id)))
  const byRating = [...expired].sort(
    (a, b) => overall(state.players[b]) - overall(state.players[a]),
  )
  byRating.forEach((id) => {
    if (team.playerIds.length - expired.length + keep.size < MIN_ROSTER) keep.add(id)
  })
  const renewed: string[] = []
  const departed: string[] = []
  expired.forEach((id) => {
    const player = state.players[id]
    if (keep.has(id)) {
      player.years = renewalYears(player)
      player.salary = money(player.salary * 1.05)
      renewed.push(player.name)
      recordMove(state, {
        kind: 'renewal',
        playerId: id,
        fromTeamId: team.id,
        toTeamId: team.id,
        fee: 0,
        note: `${player.years}y at $${player.salary.toLocaleString('en-US')}/yr`,
      })
      return
    }
    team.playerIds = team.playerIds.filter((candidate) => candidate !== id)
    player.teamId = null
    player.status = 'free-agent'
    player.years = 1
    departed.push(player.name)
    recordMove(state, { kind: 'expiry', playerId: id, fromTeamId: team.id, toTeamId: null, fee: 0 })
  })
  refillLineup(state, team)
  if (managed) {
    if (departed.length)
      state.inbox.unshift(`Contracts expired and left for free agency: ${departed.join(', ')}.`)
    if (renewed.length)
      state.inbox.unshift(`Re-signed to keep a legal roster of five: ${renewed.join(', ')}.`)
  }
}
function overall(player: Player) {
  return Object.values(player.ratings).reduce((a, b) => a + b, 0) / skills.length
}
export function rolloverSeason(state: GameState) {
  const openingByes = new Set(
    regions.flatMap((region) => regionalPlayoffQualifiers(state, 'Stage 2', region, 4)),
  )
  const finishedSeason = state.season
  state.week = 1
  state.season++
  Object.values(state.players).forEach((player) => {
    ageDevelopment(player)
    if (player.teamId) player.years--
  })
  Object.values(state.teams).forEach((team) => {
    resolveExpiredContracts(state, team)
    team.championshipPoints = 0
    team.wins = 0
    team.losses = 0
    team.mapWins = 0
    team.mapLosses = 0
  })
  state.jobs.forEach((job) => {
    if (job.status === 'pending') job.status = 'declined'
  })
  Object.entries(state.kickoff).forEach(([id, record]) => {
    record.wins = 0
    record.losses = 0
    record.status = 'active'
    record.openingBye = openingByes.has(id)
    state.teams[id].playoffStage = record.openingBye ? 'Kickoff · Round 1 bye' : 'Kickoff · 3 lives'
  })
  state.inbox.unshift(
    `Season ${finishedSeason} is complete. Championship Points are reset, players are a year older, and the season ${state.season} Kickoff bracket is ready.`,
  )
}
function tickCalendar(state: GameState) {
  updateDevelopmentAndFinances(state)
  const phase = phaseForWeek(state.week)
  if (phase === 'Break') {
    state.inbox.unshift(
      `Calendar break before ${breakWeeks[state.week] ?? 'the next event'}. No match was scheduled this week.`,
    )
  } else {
    state.inbox.unshift(
      `${currentTeam(state).name} had no scheduled match in ${phaseLabel(state.week)}.`,
    )
  }
  finalizeCalendarWeek(state)
  return state
}
function buildIntraWeekRounds(
  state: GameState,
  attackStyle: string,
  defenseStyle: string,
  autoPlay: boolean,
) {
  const phase = phaseForWeek(state.week)
  if (phase === 'Kickoff')
    regions.forEach((region) =>
      finishKickoffRegion(state, region, attackStyle, defenseStyle, autoPlay),
    )
  if (phase === 'Stage 1' || phase === 'Stage 2')
    finishRegionalWeek(state, phase, state.week, attackStyle, defenseStyle, autoPlay)
  if (phase === 'Masters 1' || phase === 'Masters 2' || phase === 'Champions')
    finishInternationalWeek(state, phase, state.week, attackStyle, defenseStyle, autoPlay)
}
function nextScheduledTournamentFixture(
  state: GameState,
  phase?: Exclude<CompetitionPhase, 'Break' | 'Offseason'>,
  region?: Region,
) {
  return fixturesForWeek(state, state.week)
    .filter(
      (candidate) =>
        candidate.status === 'scheduled' &&
        (!phase || candidate.phase === phase) &&
        (!region || candidate.region === region),
    )
    .sort(
      (left, right) =>
        left.round - right.round ||
        left.label.localeCompare(right.label) ||
        left.id.localeCompare(right.id),
    )[0]
}
export function canPlayNextTournamentMatch(
  input: GameState,
  phase?: Exclude<CompetitionPhase, 'Break' | 'Offseason'>,
  region?: Region,
) {
  if (nextScheduledTournamentFixture(input, phase, region)) return true
  const peek: GameState = structuredClone(input)
  ensureWeekScheduled(peek, peek.week)
  buildIntraWeekRounds(peek, 'Measured defaults', 'Disciplined retakes', false)
  return Boolean(nextScheduledTournamentFixture(peek, phase, region))
}
export function simulateNextTournamentMatch(
  input: GameState,
  attackStyle: string,
  defenseStyle: string,
  phase?: Exclude<CompetitionPhase, 'Break' | 'Offseason'>,
  region?: Region,
): GameState {
  const state: GameState = structuredClone(input)
  ensureWeekScheduled(state, state.week)
  buildIntraWeekRounds(state, attackStyle, defenseStyle, false)
  const fixture = nextScheduledTournamentFixture(state, phase, region)
  if (!fixture) return state
  const result = playFixture(state, fixture, attackStyle, defenseStyle)
  if (result) {
    const winner = state.teams[result.winnerId]
    const loserId = result.winnerId === result.aId ? result.bId : result.aId
    const winnerScore = result.winnerId === result.aId ? result.aScore : result.bScore
    const loserScore = result.winnerId === result.aId ? result.bScore : result.aScore
    state.inbox.unshift(
      winner.name +
        ' defeated ' +
        state.teams[loserId].name +
        ' ' +
        winnerScore +
        '-' +
        loserScore +
        ' in ' +
        fixture.label +
        '.',
    )
  }
  buildIntraWeekRounds(state, attackStyle, defenseStyle, false)
  state.saveTimestamp = new Date().toISOString()
  saveGame(state)
  return state
}
export function playableTournamentFixtureIds(state: GameState) {
  const phase = phaseForWeek(state.week)
  if (phase === 'Break' || phase === 'Offseason') return []
  return liveStepFixtures(
    fixturesForWeek(state, state.week).filter(
      (fixture) => fixture.status === 'scheduled' && fixture.bId,
    ),
  ).map((fixture) => fixture.id)
}
function reportTournamentResult(state: GameState, fixture: Fixture, result: MatchResult) {
  const winner = state.teams[result.winnerId]
  const loserId = result.winnerId === result.aId ? result.bId : result.aId
  const winnerScore = result.winnerId === result.aId ? result.aScore : result.bScore
  const loserScore = result.winnerId === result.aId ? result.bScore : result.aScore
  state.inbox.unshift(
    `${winner.name} defeated ${state.teams[loserId].name} ${winnerScore}-${loserScore} in ${fixture.label}.`,
  )
}
/** Plays one fixture from the live round; once the round is finished, the rest of the
 * round (other regions) is played and the event moves on to the next round or week. */
export function simulateTournamentFixture(
  input: GameState,
  fixtureId: string,
  attackStyle: string,
  defenseStyle: string,
): GameState {
  const phase = phaseForWeek(input.week)
  if (phase === 'Break' || phase === 'Offseason') return input
  const state: GameState = structuredClone(input)
  ensureWeekScheduled(state, state.week)
  buildIntraWeekRounds(state, attackStyle, defenseStyle, false)
  const step = liveStepFixtures(
    fixturesForWeek(state, state.week).filter((fixture) => fixture.status === 'scheduled'),
  )
  const fixture = step.find((candidate) => candidate.id === fixtureId)
  if (!fixture) return input
  const result = playFixture(state, fixture, attackStyle, defenseStyle)
  if (result) reportTournamentResult(state, fixture, result)
  const roundDone = step
    .filter(
      (candidate) =>
        candidate.phase === fixture.phase &&
        (fixture.scope === 'international' || candidate.region === fixture.region),
    )
    .every((candidate) => candidate.status === 'completed' || !candidate.bId)
  if (roundDone) {
    step.forEach((candidate) => {
      if (candidate.status === 'scheduled') playFixture(state, candidate, attackStyle, defenseStyle)
    })
    state.inbox.unshift(`${phase} ${fixture.label} completed. The bracket has been updated.`)
  }
  buildIntraWeekRounds(state, attackStyle, defenseStyle, false)
  const remaining = fixturesForWeek(state, state.week).some(
    (candidate) => candidate.status === 'scheduled' && candidate.bId,
  )
  if (roundDone && !remaining) {
    updateDevelopmentAndFinances(state)
    finalizeCalendarWeek(state)
    return state
  }
  state.saveTimestamp = new Date().toISOString()
  saveGame(state)
  return state
}
function playScheduledByLabel(
  state: GameState,
  phase: 'Masters 1' | 'Masters 2' | 'Champions',
  week: number,
  labels: string[],
  attackStyle: string,
  defenseStyle: string,
) {
  let managed: MatchResult | null = null
  state.fixtures
    .filter(
      (f) =>
        f.season === state.season &&
        f.phase === phase &&
        f.week === week &&
        f.status === 'scheduled' &&
        labels.includes(f.label),
    )
    .forEach((fixture) => {
      const result = playFixture(state, fixture, attackStyle, defenseStyle)
      if (result && (result.aId === state.currentTeamId || result.bId === state.currentTeamId))
        managed = result
    })
  return managed
}
function internationalFixtures(
  state: GameState,
  phase: 'Masters 1' | 'Masters 2' | 'Champions',
  label: string,
) {
  return state.fixtures.filter(
    (fixture) =>
      fixture.season === state.season && fixture.phase === phase && fixture.label === label,
  )
}
function finishInternationalWeek(
  state: GameState,
  phase: 'Masters 1' | 'Masters 2' | 'Champions',
  week: number,
  attackStyle: string,
  defenseStyle: string,
  autoPlay = true,
) {
  let managed: MatchResult | null = null
  const play = (...labels: string[]) => {
    if (!autoPlay) return
    const result = playScheduledByLabel(state, phase, week, labels, attackStyle, defenseStyle)
    if (result) managed = result
  }
  const existing = (label: string) => internationalFixtures(state, phase, label)
  const completed = (label: string) =>
    existing(label).filter((fixture) => fixture.status === 'completed')
  if (phase === 'Masters 1' || phase === 'Masters 2') {
    const start = phase === 'Masters 1' ? 8 : 20
    if (week === start + 1) {
      if (
        completed('Swiss Advancement').length === 2 &&
        completed('Swiss Elimination').length === 2 &&
        !existing('Swiss Decider').length
      ) {
        const entrants = mastersEntrants(state, phase).swiss.filter((id) => {
          const record = swissRecord(state, phase, id)
          return record.wins === 1 && record.losses === 1
        })
        addInternationalFixtures(state, phase, week, 'Swiss Decider', pairPool(state, entrants), {
          stage: 'Swiss',
          bracket: 'Swiss',
          round: 3,
        })
        play('Swiss Decider')
      }
      return managed
    }
    if (week === start + 2) {
      const qf = completed('Upper Quarterfinal')
      if (qf.length === 4 && !existing('Upper Semifinal').length) {
        addInternationalFixtures(
          state,
          phase,
          week,
          'Upper Semifinal',
          [
            [resultWinner(qf[0])!, resultWinner(qf[1])!],
            [resultWinner(qf[2])!, resultWinner(qf[3])!],
          ],
          { stage: 'Playoffs', bracket: 'Upper', round: 2 },
        )
        addInternationalFixtures(
          state,
          phase,
          week,
          'Lower Round 1',
          [
            [resultLoser(qf[0])!, resultLoser(qf[1])!],
            [resultLoser(qf[2])!, resultLoser(qf[3])!],
          ],
          { stage: 'Playoffs', bracket: 'Lower', round: 2 },
        )
        play('Upper Semifinal', 'Lower Round 1')
      }
      if (completed('Upper Semifinal').length !== 2 || completed('Lower Round 1').length !== 2)
        return managed
      if (!existing('Upper Final').length) {
        const upperSemis = completed('Upper Semifinal'),
          lowerOne = completed('Lower Round 1')
        addInternationalFixtures(
          state,
          phase,
          week,
          'Upper Final',
          [[resultWinner(upperSemis[0])!, resultWinner(upperSemis[1])!]],
          { stage: 'Playoffs', bracket: 'Upper', round: 3 },
        )
        addInternationalFixtures(
          state,
          phase,
          week,
          'Lower Round 2',
          [
            [resultLoser(upperSemis[0])!, resultWinner(lowerOne[1])!],
            [resultLoser(upperSemis[1])!, resultWinner(lowerOne[0])!],
          ],
          { stage: 'Playoffs', bracket: 'Lower', round: 3 },
        )
        play('Upper Final', 'Lower Round 2')
      }
      if (completed('Upper Final').length !== 1 || completed('Lower Round 2').length !== 2)
        return managed
      if (!existing('Lower Round 3').length) {
        const lowerTwo = completed('Lower Round 2')
        addInternationalFixtures(
          state,
          phase,
          week,
          'Lower Round 3',
          [[resultWinner(lowerTwo[0])!, resultWinner(lowerTwo[1])!]],
          { stage: 'Playoffs', bracket: 'Lower', round: 4 },
        )
        play('Lower Round 3')
      }
      if (completed('Lower Round 3').length !== 1) return managed
      if (!existing('Lower Final').length) {
        const upperFinal = completed('Upper Final')[0],
          lowerThree = completed('Lower Round 3')[0]
        addInternationalFixtures(
          state,
          phase,
          week,
          'Lower Final',
          [[resultLoser(upperFinal)!, resultWinner(lowerThree)!]],
          { stage: 'Playoffs', bracket: 'Lower', round: 5, bestOf: 5 },
        )
        play('Lower Final')
      }
      if (completed('Lower Final').length !== 1) return managed
      if (!existing('Grand Final').length) {
        const upperFinal = completed('Upper Final')[0],
          lowerFinal = completed('Lower Final')[0]
        addInternationalFixtures(
          state,
          phase,
          week,
          'Grand Final',
          [[resultWinner(upperFinal)!, resultWinner(lowerFinal)!]],
          { stage: 'Playoffs', bracket: 'Final', round: 6, bestOf: 5 },
        )
        play('Grand Final')
      }
    }
    return managed
  }
  if (week === 41) {
    if (
      completed('Upper Final').length === 1 &&
      completed('Lower Round 2').length === 2 &&
      !existing('Lower Round 3').length
    ) {
      const lowerTwo = completed('Lower Round 2')
      addInternationalFixtures(
        state,
        'Champions',
        week,
        'Lower Round 3',
        [[resultWinner(lowerTwo[0])!, resultWinner(lowerTwo[1])!]],
        { stage: 'Playoffs', bracket: 'Lower', round: 4 },
      )
      play('Lower Round 3')
    }
  }
  if (week === 42) {
    if (
      completed('Upper Final').length === 1 &&
      completed('Lower Final').length === 1 &&
      !existing('Grand Final').length
    ) {
      const upperFinal = completed('Upper Final')[0],
        lowerFinal = completed('Lower Final')[0]
      addInternationalFixtures(
        state,
        'Champions',
        week,
        'Grand Final',
        [[resultWinner(upperFinal)!, resultWinner(lowerFinal)!]],
        { stage: 'Playoffs', bracket: 'Final', round: 6, bestOf: 5 },
      )
      play('Grand Final')
    }
  }
  return managed
}

function finishKickoffRegion(
  state: GameState,
  region: Region,
  attackStyle: string,
  defenseStyle: string,
  autoPlay = true,
) {
  const completed = (label: string) =>
    state.fixtures
      .filter(
        (fixture) =>
          fixture.season === state.season &&
          fixture.phase === 'Kickoff' &&
          fixture.region === region &&
          fixture.label === label &&
          fixture.status === 'completed',
      )
      .sort((left, right) => left.id.localeCompare(right.id))
  const existing = (label: string) =>
    state.fixtures.filter(
      (fixture) =>
        fixture.season === state.season &&
        fixture.phase === 'Kickoff' &&
        fixture.region === region &&
        fixture.label === label,
    )
  const winner = (label: string, index = 0) => resultWinner(completed(label)[index])
  const loser = (label: string, index = 0) => resultLoser(completed(label)[index])
  const playNew = (fixtures: Fixture[]) => {
    if (autoPlay)
      fixtures
        .filter((fixture) => fixture.status === 'scheduled')
        .forEach((fixture) => playFixture(state, fixture, attackStyle, defenseStyle))
  }

  if (completed('Middle Round 4').length !== 1 || completed('Lower Round 3').length !== 2) return
  if (!existing('Lower Round 4').length) {
    addKickoffFixtures(state, region, 6, 7, 'Lower Round 4', [
      [winner('Lower Round 3', 0)!, winner('Lower Round 3', 1)!],
    ])
    playNew(existing('Lower Round 4'))
  }
  if (completed('Lower Round 4').length !== 1) return
  if (!existing('Middle Final').length) {
    addKickoffFixtures(
      state,
      region,
      6,
      8,
      'Middle Final',
      [[loser('Upper Final')!, winner('Middle Round 4')!]],
      5,
    )
    playNew(existing('Middle Final'))
  }
  if (!existing('Lower Round 5').length) {
    addKickoffFixtures(state, region, 6, 8, 'Lower Round 5', [
      [loser('Middle Round 4')!, winner('Lower Round 4')!],
    ])
    playNew(existing('Lower Round 5'))
  }
  if (completed('Middle Final').length !== 1 || completed('Lower Round 5').length !== 1) return
  if (!existing('Lower Final').length) {
    addKickoffFixtures(
      state,
      region,
      6,
      9,
      'Lower Final',
      [[loser('Middle Final')!, winner('Lower Round 5')!]],
      5,
    )
    playNew(existing('Lower Final'))
  }
  if (completed('Lower Final').length !== 1) return
  const qualified = [winner('Upper Final'), winner('Middle Final'), winner('Lower Final')].filter(
    (id): id is string => Boolean(id),
  )
  qualified.forEach((id) => {
    if (state.kickoff[id].status === 'qualified') return
    state.kickoff[id].status = 'qualified'
    state.teams[id].playoffStage = 'Masters 1 · qualified'
    state.teams[id].championshipPoints += 2
  })
}
function updateDevelopmentAndFinances(state: GameState) {
  Object.values(state.players).forEach((player) => {
    const managed = player.teamId === state.currentTeamId
    const allocation = state.training[player.id] ?? (managed ? {} : DEFAULT_TRAINING)
    developPlayer(player, allocation, () => random(state))
  })
  Object.entries(state.scoutingHours).forEach(([id, hours]) => {
    if (state.players[id])
      state.players[id].scoutProgress = Math.min(
        100,
        state.players[id].scoutProgress + hours * 0.35,
      )
  })
  Object.values(state.teams).forEach((team) => {
    team.cash -= team.playerIds.reduce((sum, id) => sum + (state.players[id]?.salary ?? 0) / 52, 0)
  })
}
export function simulateTournamentRound(
  input: GameState,
  attackStyle: string,
  defenseStyle: string,
): GameState {
  const phase = phaseForWeek(input.week)
  if (phase === 'Break' || phase === 'Offseason')
    return advanceWeek(input, attackStyle, defenseStyle)
  const state: GameState = structuredClone(input)
  ensureWeekScheduled(state, state.week)
  buildIntraWeekRounds(state, attackStyle, defenseStyle, false)
  const scheduled = fixturesForWeek(state, state.week).filter(
    (fixture) => fixture.status === 'scheduled',
  )
  if (!scheduled.length) return tickCalendar(state)
  const step = liveStepFixtures(scheduled)
  step.forEach((fixture) => playFixture(state, fixture, attackStyle, defenseStyle))
  buildIntraWeekRounds(state, attackStyle, defenseStyle, false)
  const remaining = fixturesForWeek(state, state.week).some(
    (fixture) => fixture.status === 'scheduled',
  )
  if (!remaining && !isPackedTournamentWeek(state.week)) {
    updateDevelopmentAndFinances(state)
    finalizeCalendarWeek(state)
    return state
  }
  state.inbox.unshift(phase + ' ' + step[0].label + ' completed. The bracket has been updated.')
  state.saveTimestamp = new Date().toISOString()
  saveGame(state)
  return state
}

export function advanceWeek(
  input: GameState,
  attackStyle: string,
  defenseStyle: string,
): GameState {
  const state: GameState = structuredClone(input),
    phase = phaseForWeek(state.week),
    managedTeam = currentTeam(state)
  updateDevelopmentAndFinances(state)
  ensureWeekScheduled(state, state.week)
  if (phase === 'Break') {
    state.inbox.unshift(
      `Calendar break before ${breakWeeks[state.week] ?? 'the next event'}. No match was scheduled this week.`,
    )
  } else if (phase !== 'Offseason') {
    const fixtures = fixturesForWeek(state, state.week)
      .filter((f) => f.status === 'scheduled')
      .sort(
        (left, right) =>
          Number(left.aId === state.currentTeamId || left.bId === state.currentTeamId) -
          Number(right.aId === state.currentTeamId || right.bId === state.currentTeamId),
      )
    let managedResult: MatchResult | null = null
    fixtures.forEach((fixture) => {
      const result = playFixture(state, fixture, attackStyle, defenseStyle)
      if (result && (result.aId === state.currentTeamId || result.bId === state.currentTeamId))
        managedResult = result
    })
    if (phase === 'Kickoff' && state.week === 6) {
      regions.forEach((region) => finishKickoffRegion(state, region, attackStyle, defenseStyle))
      managedResult =
        state.matches.find(
          (match) =>
            match.week === 6 &&
            (match.aId === state.currentTeamId || match.bId === state.currentTeamId),
        ) ?? managedResult
    }
    if (phase === 'Stage 1' || phase === 'Stage 2') {
      const regionalResult = finishRegionalWeek(state, phase, state.week, attackStyle, defenseStyle)
      if (regionalResult) managedResult = regionalResult
    }
    if (phase === 'Masters 1' || phase === 'Masters 2' || phase === 'Champions') {
      const internationalResult = finishInternationalWeek(
        state,
        phase,
        state.week,
        attackStyle,
        defenseStyle,
      )
      if (internationalResult) managedResult = internationalResult
    }
    if (managedResult) {
      const result = managedResult as MatchResult
      const opponentId = result.aId === managedTeam.id ? result.bId : result.aId,
        opponent = state.teams[opponentId]
      const ownScore = result.aId === managedTeam.id ? result.aScore : result.bScore
      const opponentScore = result.aId === managedTeam.id ? result.bScore : result.aScore
      managedTeam.cash += result.winnerId === managedTeam.id ? 25000 : 5000
      state.inbox.unshift(
        result.winnerId === managedTeam.id
          ? `${managedTeam.name} defeated ${opponent.name} ${ownScore}-${opponentScore} in ${result.phase}.`
          : `${managedTeam.name} fell to ${opponent.name} ${ownScore}-${opponentScore} in ${result.phase}.`,
      )
    } else
      state.inbox.unshift(
        `${managedTeam.name} had no scheduled match in ${phaseLabel(state.week)}.`,
      )
  }
  finalizeCalendarWeek(state)
  return state
}
export function acceptJob(state: GameState, id: string) {
  const nextState = structuredClone(state),
    job = nextState.jobs.find((candidate) => candidate.id === id)
  if (!job) return nextState
  nextState.currentTeamId = job.teamId
  job.status = 'accepted'
  nextState.inbox.unshift(`You accepted the manager role at ${nextState.teams[job.teamId].name}.`)
  saveGame(nextState)
  return nextState
}
export { SAVE_KEY }
