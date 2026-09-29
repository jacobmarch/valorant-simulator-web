import type { GameState, Player, PlayerStatus, Team, TransferRecord } from './game'
import { MORALE_DEFAULT, overallRating, seedPotential } from './development'
import { bestRoleAssignment } from './roles'
import { refreshIgl } from './igl'
import { roles, type Region } from './seed'
import { payroll } from './sponsors'

export const MIN_ROSTER = 5
export const MAX_ROSTER = 7
export const MAX_IMPORTS = 1
const MIN_FREE_AGENTS = 12
const AI_CASH_RESERVE = 300000
const AI_BUYOUTS_PER_WEEK = 3
// A player who has just changed teams cannot be bought out by an AI club again for this many
// weeks; without it the same star was traded between clubs every week of a window.
const AI_BUYOUT_COOLDOWN_WEEKS = 26

export type TransferWindow = { label: string; start: number; end: number }
// Weeks in which signings, buyouts, and releases are allowed. Status changes are always allowed.
export const transferWindows: TransferWindow[] = [
  { label: 'Preseason window', start: 1, end: 1 },
  { label: 'Stage 1 window', start: 11, end: 11 },
  { label: 'Stage 2 window', start: 23, end: 23 },
  { label: 'Offseason window', start: 43, end: 52 },
]

/** From this week the season is over and expiring contracts can be renegotiated. */
export const RENEGOTIATION_START_WEEK = 43

export type TransferOutcome = { ok: true; state: GameState } | { ok: false; error: string }

const money = (value: number) => Math.round(value / 1000) * 1000
const dollars = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`
const random = (state: GameState) => {
  state.rng = (state.rng * 1664525 + 1013904223) >>> 0
  return state.rng / 4294967296
}

export function transferWindowForWeek(week: number) {
  return transferWindows.find((window) => week >= window.start && week <= window.end) ?? null
}
export function nextTransferWindow(week: number) {
  return (
    transferWindows.find((window) => window.start > week) ??
    // Wraps into next season's preseason window.
    transferWindows[0]
  )
}
// What a player asks for a new contract each year. It climbs steeply with overall: a
// league-average 75 wants about $120k, an 85 about $350k, a 90 about $600k and a 95 about $1M,
// so a roster full of stars costs far more than sponsors alone pay.
const DEMAND_AT_75 = 120000
const DEMAND_GROWTH = 0.107
const MIN_SALARY = 25000
export function salaryForOverall(overall: number) {
  return Math.max(MIN_SALARY, money(DEMAND_AT_75 * Math.exp(DEMAND_GROWTH * (overall - 75))))
}
export function salaryDemand(player: Player) {
  return salaryForOverall(overallRating(player.ratings))
}
/** Annual salary on the table: free agents ask their current demand, others earn their contract. */
export function askingSalary(player: Player) {
  return player.status === 'free-agent' ? salaryDemand(player) : player.salary
}
/** Salary on the player's next contract. Nobody takes a pay cut to change teams. */
export function newContractSalary(player: Player) {
  const demand = salaryDemand(player)
  return player.status === 'free-agent' ? demand : Math.max(player.salary, demand)
}
/** Longest new contract a player will sign: veterans only take one year. */
export function maxRenewalYears(player: Player) {
  if (player.age >= 30) return 1
  return player.age <= 23 ? 3 : 2
}
export function canRenegotiate(state: GameState, player: Player) {
  return (
    state.week >= RENEGOTIATION_START_WEEK &&
    player.teamId === state.currentTeamId &&
    player.years <= 1
  )
}
/** Agrees new terms now; they take effect when the current contract ends at rollover. */
export function renegotiateContract(
  input: GameState,
  playerId: string,
  years: number,
): TransferOutcome {
  const player = input.players[playerId]
  if (!player || player.teamId !== input.currentTeamId)
    return { ok: false, error: 'That player is not on your roster.' }
  if (input.week < RENEGOTIATION_START_WEEK)
    return {
      ok: false,
      error: `Contracts can be renegotiated once the season ends, from week ${RENEGOTIATION_START_WEEK}.`,
    }
  if (player.years > 1)
    return { ok: false, error: `${player.name} still has ${player.years} years on their contract.` }
  const max = maxRenewalYears(player)
  if (!Number.isInteger(years) || years < 1 || years > max)
    return {
      ok: false,
      error: `${player.name} will only sign for 1${max > 1 ? `–${max}` : ''} year${max > 1 ? 's' : ''}.`,
    }
  const state = structuredClone(input)
  state.players[playerId].renewal = { years, salary: salaryDemand(state.players[playerId]) }
  return { ok: true, state }
}
export function cancelRenewal(input: GameState, playerId: string): GameState {
  const state = structuredClone(input)
  if (state.players[playerId]) delete state.players[playerId].renewal
  return state
}
/** How many players the managed team still needs before it can field a match. */
export function rosterShortfall(state: GameState) {
  const team = state.teams[state.currentTeamId]
  const active = team.playerIds.filter((id) => state.players[id]?.status !== 'inactive').length
  return Math.max(0, 5 - active)
}
/** Why the calendar cannot move yet, if the managed team is short of players. */
export function rosterBlock(state: GameState) {
  const missing = rosterShortfall(state)
  return missing
    ? `${state.teams[state.currentTeamId].name} needs ${missing} more player${missing === 1 ? '' : 's'} to field five. Sign ${missing === 1 ? 'a free agent' : 'free agents'} before Kickoff.`
    : null
}
export function contractValue(player: Player) {
  return money(askingSalary(player) * player.years)
}
export function playerOverall(player: Player) {
  return Math.round(Object.values(player.ratings).reduce((a, b) => a + b, 0) / 6)
}
export function freeAgents(state: GameState) {
  return Object.values(state.players).filter((player) => player.status === 'free-agent')
}
export function contractedPlayers(state: GameState, excludeTeamId?: string) {
  return Object.values(state.players).filter(
    (player) => player.teamId && player.teamId !== excludeTeamId && player.status !== 'free-agent',
  )
}
export function rosterHistory(state: GameState, teamId?: string) {
  return (state.transfers ?? []).filter(
    (record) => !teamId || record.fromTeamId === teamId || record.toTeamId === teamId,
  )
}

// Every rule an organization's roster must satisfy, as human-readable failures.
export function rosterViolations(state: GameState, teamId: string) {
  const team = state.teams[teamId]
  const players = team.playerIds.map((id) => state.players[id]).filter(Boolean)
  const eligible = players.filter((player) => player.status !== 'inactive')
  const imports = players.filter((player) => player.isImport)
  const errors: string[] = []
  if (players.length < MIN_ROSTER)
    errors.push(`${team.name} has ${players.length} players; the minimum roster is ${MIN_ROSTER}.`)
  if (players.length > MAX_ROSTER)
    errors.push(`${team.name} has ${players.length} players; the maximum roster is ${MAX_ROSTER}.`)
  if (eligible.length < 5)
    errors.push(`${team.name} has ${eligible.length} active players; a match needs 5.`)
  if (imports.length > MAX_IMPORTS)
    errors.push(`${team.name} has ${imports.length} import players; the limit is ${MAX_IMPORTS}.`)
  if (team.lineup.length !== 5) errors.push(`${team.name} has ${team.lineup.length}/5 starters.`)
  team.lineup.forEach((id) => {
    const player = state.players[id]
    if (!player || player.teamId !== teamId)
      errors.push(`${team.name}'s lineup includes a player who is not on the roster.`)
    else if (player.status === 'inactive')
      errors.push(`${player.name} is inactive and cannot start for ${team.name}.`)
  })
  return errors
}

// Rebuilds the five-player lineup from starters first, then substitutes, keeping role assignments.
export function repairLineup(state: GameState, teamId: string) {
  const team = state.teams[teamId]
  const eligible = team.playerIds.filter((id) => {
    const player = state.players[id]
    return player && player.status !== 'inactive'
  })
  const starters = eligible.filter((id) => state.players[id].status === 'starter')
  const substitutes = eligible.filter((id) => state.players[id].status !== 'starter')
  const kept = team.lineup.filter((id) => starters.includes(id))
  team.lineup = [
    ...kept,
    ...starters.filter((id) => !kept.includes(id)),
    ...substitutes.filter((id) => !kept.includes(id)),
  ].slice(0, 5)
  team.roleAssignments = Object.fromEntries(
    team.lineup.map((id) => [id, team.roleAssignments[id] ?? state.players[id].primaryRole]),
  )
  if (teamId !== state.currentTeamId)
    team.roleAssignments = bestRoleAssignment(team.lineup.map((id) => state.players[id]))
}

export function recordMove(
  state: GameState,
  entry: Omit<TransferRecord, 'id' | 'season' | 'week' | 'playerName'>,
) {
  state.transfers ??= []
  state.transfers.unshift({
    ...entry,
    id: `move-${state.season}-${state.week}-${state.transfers.length + 1}`,
    season: state.season,
    week: state.week,
    playerName: state.players[entry.playerId].name,
  })
}
function windowError(state: GameState) {
  if (transferWindowForWeek(state.week)) return null
  const next = nextTransferWindow(state.week)
  return `The transfer window is closed in week ${state.week}. The ${next.label} opens in week ${next.start}.`
}
function importAfterMove(player: Player, team: Team) {
  return player.isImport || (player.region !== null && player.region !== team.region)
}
function importError(state: GameState, player: Player, team: Team) {
  if (!importAfterMove(player, team)) return null
  const existing = team.playerIds
    .map((id) => state.players[id])
    .filter((other) => other && other.isImport && other.id !== player.id)
  return existing.length >= MAX_IMPORTS
    ? `Signing ${player.name} would be an import and ${team.name} already has ${existing.map((other) => other.name).join(', ')}; the limit is ${MAX_IMPORTS}.`
    : null
}
function joinTeam(state: GameState, player: Player, team: Team) {
  player.isImport = importAfterMove(player, team)
  player.teamId = team.id
  player.region = team.region
  player.status = 'substitute'
  team.playerIds.push(player.id)
  repairLineup(state, team.id)
}
function leaveTeam(state: GameState, player: Player) {
  const team = player.teamId ? state.teams[player.teamId] : null
  if (!team) return
  team.playerIds = team.playerIds.filter((id) => id !== player.id)
  team.lineup = team.lineup.filter((id) => id !== player.id)
  delete team.roleAssignments[player.id]
  repairLineup(state, team.id)
}

export function signFreeAgentError(state: GameState, teamId: string, playerId: string) {
  const team = state.teams[teamId],
    player = state.players[playerId]
  if (!team || !player) return 'That player or team no longer exists.'
  if (player.status !== 'free-agent') return `${player.name} is not a free agent.`
  const closed = windowError(state)
  if (closed) return closed
  if (team.playerIds.length >= MAX_ROSTER)
    return `${team.name} already has ${MAX_ROSTER} players, the maximum roster. Release someone first.`
  const cost = contractValue(player)
  if (team.cash < cost)
    return `${team.name} has ${dollars(team.cash)} but signing ${player.name} costs ${dollars(cost)}.`
  return importError(state, player, team)
}
export function signFreeAgent(input: GameState, teamId: string, playerId: string): TransferOutcome {
  const error = signFreeAgentError(input, teamId, playerId)
  if (error) return { ok: false, error }
  const state = structuredClone(input)
  applySigning(state, teamId, playerId)
  return { ok: true, state }
}
function applySigning(state: GameState, teamId: string, playerId: string) {
  const team = state.teams[teamId],
    player = state.players[playerId],
    cost = contractValue(player)
  player.salary = newContractSalary(player)
  team.cash -= cost
  joinTeam(state, player, team)
  recordMove(state, {
    kind: 'signing',
    playerId,
    fromTeamId: null,
    toTeamId: teamId,
    fee: cost,
  })
  if (teamId === state.currentTeamId)
    state.inbox.unshift(`Signed ${player.name} from the free-agent market for ${dollars(cost)}.`)
}

export function buyOutError(state: GameState, buyerId: string, playerId: string) {
  const buyer = state.teams[buyerId],
    player = state.players[playerId]
  if (!buyer || !player) return 'That player or team no longer exists.'
  if (!player.teamId || player.status === 'free-agent')
    return `${player.name} is a free agent; sign them instead of buying out a contract.`
  if (player.teamId === buyerId) return `${player.name} is already on ${buyer.name}.`
  const closed = windowError(state)
  if (closed) return closed
  const seller = state.teams[player.teamId]
  if (buyer.playerIds.length >= MAX_ROSTER)
    return `${buyer.name} already has ${MAX_ROSTER} players, the maximum roster. Release someone first.`
  const fee = contractValue(player)
  if (buyer.cash < fee)
    return `${buyer.name} has ${dollars(buyer.cash)} but ${player.name}'s buyout is ${dollars(fee)}.`
  // An AI seller signs a free-agent replacement; the manager's own team must stay legal by hand.
  if (seller.playerIds.length <= MIN_ROSTER && seller.id === state.currentTeamId)
    return `Selling ${player.name} would leave ${seller.name} with ${seller.playerIds.length - 1} players; the minimum roster is ${MIN_ROSTER}.`
  return importError(state, player, buyer)
}
export function buyOutPlayer(input: GameState, buyerId: string, playerId: string): TransferOutcome {
  const error = buyOutError(input, buyerId, playerId)
  if (error) return { ok: false, error }
  const state = structuredClone(input)
  applyBuyout(state, buyerId, playerId)
  return { ok: true, state }
}
function applyBuyout(state: GameState, buyerId: string, playerId: string) {
  const buyer = state.teams[buyerId],
    player = state.players[playerId],
    seller = state.teams[player.teamId as string],
    fee = contractValue(player)
  buyer.cash -= fee
  seller.cash += fee
  player.salary = newContractSalary(player)
  leaveTeam(state, player)
  joinTeam(state, player, buyer)
  recordMove(state, { kind: 'buyout', playerId, fromTeamId: seller.id, toTeamId: buyer.id, fee })
  state.inbox.unshift(
    `${buyer.name} bought out ${player.name} from ${seller.name} for ${dollars(fee)}.`,
  )
  while (seller.playerIds.length < MIN_ROSTER) {
    replenishFreeAgents(state)
    const replacement = bestAffordableFreeAgent(state, seller)
    if (!replacement) break
    applySigning(state, seller.id, replacement.id)
  }
}

export function releaseError(state: GameState, teamId: string, playerId: string) {
  const team = state.teams[teamId],
    player = state.players[playerId]
  if (!team || !player) return 'That player or team no longer exists.'
  if (player.teamId !== teamId) return `${player.name} is not on ${team.name}.`
  const closed = windowError(state)
  if (closed) return closed
  if (team.playerIds.length <= MIN_ROSTER)
    return `Releasing ${player.name} would leave ${team.name} with ${team.playerIds.length - 1} players; the minimum roster is ${MIN_ROSTER}. Sign a replacement first.`
  const eligibleAfter = team.playerIds.filter(
    (id) => id !== playerId && state.players[id].status !== 'inactive',
  ).length
  if (eligibleAfter < 5)
    return `Releasing ${player.name} would leave ${team.name} with ${eligibleAfter} active players; a match needs 5. Activate a player first.`
  return null
}
export function releasePlayer(input: GameState, teamId: string, playerId: string): TransferOutcome {
  const error = releaseError(input, teamId, playerId)
  if (error) return { ok: false, error }
  const state = structuredClone(input)
  applyRelease(state, teamId, playerId)
  return { ok: true, state }
}
function applyRelease(state: GameState, teamId: string, playerId: string) {
  const player = state.players[playerId]
  leaveTeam(state, player)
  player.teamId = null
  player.status = 'free-agent'
  delete player.renewal
  recordMove(state, { kind: 'release', playerId, fromTeamId: teamId, toTeamId: null, fee: 0 })
  if (teamId === state.currentTeamId) state.inbox.unshift(`Released ${player.name}.`)
}

export function statusChangeError(
  state: GameState,
  teamId: string,
  playerId: string,
  status: Exclude<PlayerStatus, 'free-agent'>,
) {
  const team = state.teams[teamId],
    player = state.players[playerId]
  if (!team || !player) return 'That player or team no longer exists.'
  if (player.teamId !== teamId) return `${player.name} is not on ${team.name}.`
  if (player.status === status) return null
  const others = team.playerIds.filter((id) => id !== playerId).map((id) => state.players[id])
  if (status === 'starter' && others.filter((other) => other.status === 'starter').length >= 5)
    return `${team.name} already has five starters. Move one to substitute before promoting ${player.name}.`
  if (status === 'inactive' && others.filter((other) => other.status !== 'inactive').length < 5)
    return `Benching ${player.name} would leave ${team.name} with fewer than five active players; a match needs 5.`
  return null
}
export function setPlayerStatus(
  input: GameState,
  teamId: string,
  playerId: string,
  status: Exclude<PlayerStatus, 'free-agent'>,
): TransferOutcome {
  const error = statusChangeError(input, teamId, playerId, status)
  if (error) return { ok: false, error }
  const state = structuredClone(input)
  const player = state.players[playerId]
  if (player.status === status) return { ok: true, state }
  const previous = player.status
  player.status = status
  repairLineup(state, teamId)
  recordMove(state, {
    kind: 'status',
    playerId,
    fromTeamId: teamId,
    toTeamId: teamId,
    fee: 0,
    note: `${previous} → ${status}`,
  })
  return { ok: true, state }
}

const prefixes = ['Ze', 'Kai', 'Vex', 'Nox', 'Ryu', 'Sol', 'Mav', 'Lux', 'Dax', 'Ori', 'Tav', 'Jin']
const suffixes = ['ro', 'zen', 'ix', 'ka', 'lo', 'th', 'vy', 'no', 'rex', 'sa', 'mi', 'q']
const regionList: Region[] = ['Americas', 'EMEA', 'Pacific', 'China']

// Keeps a pool of tier-2 prospects so buyouts and AI moves always have replacements to sign.
export function replenishFreeAgents(state: GameState, minimum = MIN_FREE_AGENTS) {
  let count = freeAgents(state).length
  while (count < minimum) {
    const index = Object.keys(state.players).filter((id) => id.startsWith('prospect-')).length
    const base = 58 + Math.floor(random(state) * 13)
    const name =
      prefixes[Math.floor(random(state) * prefixes.length)] +
      suffixes[Math.floor(random(state) * suffixes.length)]
    const id = `prospect-${index}`
    state.players[id] = {
      id,
      name,
      age: 17 + Math.floor(random(state) * 5),
      teamId: null,
      region: regionList[Math.floor(random(state) * regionList.length)],
      primaryRole: roles[Math.floor(random(state) * roles.length)],
      secondaryRoles: [],
      ratings: {
        Mechanics: base + Math.floor(random(state) * 4),
        Tactics: base - 1,
        Utility: base - 2,
        Consistency: base - 1,
        Clutch: base - 3,
        Teamplay: base - 1,
      },
      salary: 0,
      years: 1 + Math.floor(random(state) * 2),
      status: 'free-agent',
      isImport: false,
      scoutProgress: 0,
      form: 0,
      morale: MORALE_DEFAULT,
      potential: 0,
      igl: false,
    }
    const prospect = state.players[id]
    prospect.salary = salaryDemand(prospect)
    prospect.potential = seedPotential(
      overallRating(prospect.ratings),
      prospect.age,
      Math.floor(random(state) * 5),
    )
    refreshIgl(prospect)
    count++
  }
}
/** Payroll an AI organization will carry: its sponsor base plus half of its spare cash. */
function aiPayrollLimit(team: Team) {
  return (team.sponsor?.weekly ?? 0) * 52 * 1.15 + Math.max(0, team.cash - AI_CASH_RESERVE) / 2
}
export function payrollRoom(state: GameState, team: Team) {
  return aiPayrollLimit(team) - payroll(state, team)
}
// The best free agent the team can pay for, preferring ones that fit its payroll. Pass
// `mustSign` when the roster is short: then the cheapest option is better than nobody.
function bestAffordableFreeAgent(state: GameState, team: Team, mustSign = true) {
  const affordable = freeAgents(state).filter(
    (player) => contractValue(player) <= team.cash && !importError(state, player, team),
  )
  const room = payrollRoom(state, team)
  const fits = affordable.filter((player) => salaryDemand(player) <= room)
  if (fits.length)
    return fits.sort(
      (a, b) => playerOverall(b) - playerOverall(a) || salaryDemand(a) - salaryDemand(b),
    )[0]
  return mustSign ? affordable.sort((a, b) => salaryDemand(a) - salaryDemand(b))[0] : undefined
}

// AI organizations act during open windows. The manager's team is never a buyout target.
export function runAiTransfers(state: GameState) {
  if (!transferWindowForWeek(state.week)) return
  replenishFreeAgents(state)
  let buyouts = 0
  const aiTeams = Object.values(state.teams)
    .filter((team) => team.id !== state.currentTeamId)
    .sort((a, b) => a.id.localeCompare(b.id))
  aiTeams.forEach((team) => {
    while (team.playerIds.length < MIN_ROSTER) {
      const replacement = bestAffordableFreeAgent(state, team)
      if (!replacement) break
      applySigning(state, team.id, replacement.id)
    }
    const roll = random(state)
    if (roll < 0.12 && buyouts < AI_BUYOUTS_PER_WEEK && tryAiUpgrade(state, team)) {
      buyouts++
      return
    }
    if (roll < 0.35 && team.playerIds.length === MIN_ROSTER && team.cash > 600000) {
      const depth = bestAffordableFreeAgent(state, team, false)
      if (depth && !signFreeAgentError(state, team.id, depth.id))
        applySigning(state, team.id, depth.id)
      return
    }
    if (team.playerIds.length > MIN_ROSTER && (team.cash < 200000 || roll > 0.9)) {
      const cut = team.playerIds
        .map((id) => state.players[id])
        .filter((player) => !team.lineup.includes(player.id))
        .sort((a, b) => playerOverall(a) - playerOverall(b))[0]
      if (cut && !releaseError(state, team.id, cut.id)) applyRelease(state, team.id, cut.id)
    }
  })
  aiTeams.forEach((team) => repairLineup(state, team.id))
}
const absoluteWeek = (season: number, week: number) => season * 52 + week
function recentlyMoved(state: GameState, playerId: string) {
  const now = absoluteWeek(state.season, state.week)
  return (state.transfers ?? []).some(
    (move) =>
      move.playerId === playerId &&
      (move.kind === 'buyout' || move.kind === 'signing') &&
      now - absoluteWeek(move.season, move.week) < AI_BUYOUT_COOLDOWN_WEEKS,
  )
}
function tryAiUpgrade(state: GameState, team: Team) {
  const weakest = team.lineup
    .map((id) => state.players[id])
    .sort((a, b) => playerOverall(a) - playerOverall(b))[0]
  if (!weakest) return false
  const budget = team.cash - AI_CASH_RESERVE
  const room = payrollRoom(state, team)
  const target = contractedPlayers(state, team.id)
    .filter((player) => {
      const seller = state.teams[player.teamId as string]
      return (
        seller.id !== state.currentTeamId &&
        seller.region === team.region &&
        !recentlyMoved(state, player.id) &&
        playerOverall(player) >= playerOverall(weakest) + 4 &&
        contractValue(player) <= budget &&
        Math.max(player.salary, salaryDemand(player)) - weakest.salary <= room
      )
    })
    .sort((a, b) => playerOverall(b) - playerOverall(a) || contractValue(a) - contractValue(b))[0]
  if (!target || buyOutError(state, team.id, target.id)) return false
  applyBuyout(state, team.id, target.id)
  // The new signing starts over the weakest starter.
  state.players[weakest.id].status = 'substitute'
  state.players[target.id].status = 'starter'
  team.lineup = team.lineup.filter((id) => id !== weakest.id)
  repairLineup(state, team.id)
  if (team.playerIds.length > MAX_ROSTER - 1 && !releaseError(state, team.id, weakest.id))
    applyRelease(state, team.id, weakest.id)
  return true
}
