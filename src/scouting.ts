import { MORALE_DEFAULT, MORALE_MAX, MORALE_MIN, overallRating, seedPotential } from './development'
import type { GameState, Player, PlayerStatus, Ratings } from './game'
import type { Region } from './seed'
import { roles, skills } from './seed'
import {
  applySigning,
  isSeasonWeek,
  maxRenewalYears,
  playerOverall,
  random,
  randomName,
  repairLineup,
  salaryDemand,
  signFreeAgentError,
  type TransferOutcome,
} from './transfers'

/** Scouting regions. Each one maps onto the parent region the club league uses. */
export const SCOUT_SUBREGIONS = ['NA', 'SA', 'EMEA', 'Asia', 'China'] as const
export type ScoutSubregion = (typeof SCOUT_SUBREGIONS)[number]
export const SUBREGION_LABELS: Record<ScoutSubregion, string> = {
  NA: 'North America',
  SA: 'South America',
  EMEA: 'EMEA',
  Asia: 'Asia',
  China: 'China',
}
const parentRegion: Record<ScoutSubregion, Region> = {
  NA: 'Americas',
  SA: 'Americas',
  EMEA: 'EMEA',
  Asia: 'Pacific',
  China: 'China',
}

/** Ladder players kept in each subregion's pool. */
export const LADDER_PER_SUBREGION = 24
/** Scouting progress gained per scouting hour, applied to every ladder player in the region. */
export const SCOUT_PROGRESS_PER_HOUR = 0.35
/** A player must be scouted this far before a trial can be offered. */
export const TRIAL_MIN_SCOUTING = 25
export const TRIAL_LIMIT_SEASON = 2
export const TRIAL_LIMIT_OFFSEASON = 4
/** With this many players on the roster, a trial must take the place of a current player. */
export const TRIAL_FULL_ROSTER = 5
/** Morale a benched player loses when a trial takes their place. */
export const BENCH_MORALE_PENALTY = 25
/** Scouting progress at which general skill tiers start to show. */
export const SKILL_SCOUT_MIN = 25
// Rating ranges are never exact before a trial: the width narrows from MAX to MIN as scouting rises.
const MAX_RANGE_WIDTH = 18
const MIN_RANGE_WIDTH = 4

/** General skill tier only, so scouting never gives an exact skill. */
export function skillTier(rating: number) {
  if (rating >= 80) return 'Elite'
  if (rating >= 70) return 'Strong'
  if (rating >= 60) return 'Solid'
  return 'Developing'
}
/** Null until the region is scouted enough; exact skills appear only after a trial. */
export function scoutedSkillTiers(player: Player) {
  if (player.scoutProgress < SKILL_SCOUT_MIN) return null
  return skills.map((skill) => ({ skill, tier: skillTier(player.ratings[skill]) }))
}

/** Whether a trial would need someone on the roster to make way. */
export function trialNeedsReplacement(state: GameState) {
  return state.teams[state.currentTeamId].playerIds.length >= TRIAL_FULL_ROSTER
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const isSubregion = (value: string): value is ScoutSubregion =>
  (SCOUT_SUBREGIONS as readonly string[]).includes(value)

/** Trials a manager can start this week: fewer in season, more in the off-season and preseason. */
export function trialLimit(week: number) {
  return isSeasonWeek(week) ? TRIAL_LIMIT_SEASON : TRIAL_LIMIT_OFFSEASON
}
export function trialsUsedThisWeek(state: GameState) {
  const usage = state.trialUsage
  return usage && usage.season === state.season && usage.week === state.week ? usage.count : 0
}
export function trialsLeft(state: GameState) {
  return Math.max(0, trialLimit(state.week) - trialsUsedThisWeek(state))
}
export function hasTrialed(state: GameState, playerId: string) {
  return Boolean(state.trials?.[playerId])
}

type BenchedPlayer = { playerId: string; status: PlayerStatus; morale: number }

/** Ladder players still on the market for a club to scout, best overall first. */
export function ladderPlayers(state: GameState, subregion?: ScoutSubregion) {
  return Object.values(state.players)
    .filter(
      (player) =>
        player.status === 'free-agent' &&
        player.ladder !== undefined &&
        (subregion === undefined || player.ladder.subregion === subregion),
    )
    .sort((a, b) => playerOverall(b) - playerOverall(a))
}

// A stable 0–1 value per player, so a range always contains the true overall at the same spot.
function unitHash(id: string) {
  let hash = 2166136261
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return ((hash >>> 0) % 10000) / 10000
}

/**
 * What scouting shows before a trial: a band around the true overall. The band is never a
 * single number, and it narrows only as the region is scouted.
 */
export function scoutRange(player: Player) {
  const overall = playerOverall(player)
  const width = Math.round(
    MIN_RANGE_WIDTH + (MAX_RANGE_WIDTH - MIN_RANGE_WIDTH) * (1 - player.scoutProgress / 100),
  )
  let low = overall - Math.floor(unitHash(player.id) * (width + 1))
  let high = low + width
  if (high > 100) {
    high = 100
    low = high - width
  }
  if (low < 1) {
    low = 1
    high = Math.min(100, low + width)
  }
  return { low: clamp(low, 1, 100), high: clamp(high, 1, 100) }
}

/** Scouting hours move every ladder player in their subregion forward. */
export function advanceScouting(state: GameState) {
  for (const subregion of SCOUT_SUBREGIONS) {
    const hours = state.scoutingHours[subregion] ?? 0
    if (!hours) continue
    for (const player of ladderPlayers(state, subregion))
      player.scoutProgress = Math.min(100, player.scoutProgress + hours * SCOUT_PROGRESS_PER_HOUR)
  }
}

function createLadderPlayer(state: GameState, subregion: ScoutSubregion) {
  // Retirees get pruned, so count past the highest id rather than the number of ladder players.
  const index = Object.keys(state.players)
    .filter((id) => id.startsWith('ladder-'))
    .reduce((max, id) => Math.max(max, Number(id.slice(7)) + 1), 0)
  const base = 64 + Math.floor(random(state) * 14)
  const ratings: Ratings = {
    Mechanics: base + Math.floor(random(state) * 4),
    Tactics: base - 1,
    Utility: base - 2,
    Consistency: base - 1,
    Clutch: base - 3,
    Teamplay: base - 1,
  }
  const id = `ladder-${index}`
  const age = 18 + Math.floor(random(state) * 7)
  const player: Player = {
    id,
    name: randomName(state),
    teamId: null,
    region: parentRegion[subregion],
    primaryRole: roles[Math.floor(random(state) * roles.length)],
    secondaryRoles: [],
    ratings,
    age,
    salary: 0,
    years: 1,
    status: 'free-agent',
    isImport: false,
    scoutProgress: 0,
    potential: seedPotential(overallRating(ratings), age, Math.floor(random(state) * 5)),
    form: 0,
    morale: MORALE_DEFAULT,
    igl: false,
    ladder: { subregion },
  }
  player.salary = salaryDemand(player)
  state.players[id] = player
  return player
}

/**
 * Keeps the scouting pool stocked and the save consistent. Safe to run on every load: it tags the
 * legacy tier 2 seeds, refills each subregion, drops stale trial records, and discards scouting
 * hours saved against player ids instead of subregions.
 */
export function ensureLadder(state: GameState) {
  state.trials ??= {}
  state.scoutingHours ??= {}
  state.scoutingHours = Object.fromEntries(
    Object.entries(state.scoutingHours).filter(([key]) => isSubregion(key)),
  )
  Object.values(state.players).forEach((player) => {
    if (player.ladder && (player.status !== 'free-agent' || player.teamId)) {
      delete player.ladder
      player.region = player.teamId ? (state.teams[player.teamId]?.region ?? player.region) : null
    }
    if (!player.ladder && player.id.startsWith('tier2-') && player.status === 'free-agent') {
      const index = Number(player.id.slice(6))
      player.ladder = { subregion: SCOUT_SUBREGIONS[index % SCOUT_SUBREGIONS.length] }
      player.region = parentRegion[player.ladder.subregion]
    }
  })
  Object.keys(state.trials).forEach((id) => {
    if (!state.players[id]?.ladder) delete state.trials![id]
  })
  for (const subregion of SCOUT_SUBREGIONS) {
    const missing = LADDER_PER_SUBREGION - ladderPlayers(state, subregion).length
    for (let i = 0; i < missing; i++) createLadderPlayer(state, subregion)
  }
}

export function inviteTrialError(state: GameState, playerId: string, replaceId?: string) {
  const player = state.players[playerId]
  if (!player?.ladder || player.status !== 'free-agent')
    return 'That player is not in the scouting pool.'
  if (hasTrialed(state, playerId))
    return `${player.name} has already trialled. Offer a contract or let them go.`
  if (player.scoutProgress < TRIAL_MIN_SCOUTING)
    return `Scout ${SUBREGION_LABELS[player.ladder.subregion]} to at least ${TRIAL_MIN_SCOUTING}% before inviting ${player.name} to a trial.`
  if (trialsLeft(state) <= 0) {
    const limit = trialLimit(state.week)
    return `All ${limit} trials this week are used. The limit resets next week.`
  }
  if (trialNeedsReplacement(state)) {
    if (!replaceId)
      return 'Your roster is full, so the trial must take the place of a current player. Choose who to bench.'
    const benched = state.players[replaceId]
    if (!benched || benched.teamId !== state.currentTeamId)
      return 'That player is not on your roster.'
    if (benched.status === 'inactive') return `${benched.name} is already benched.`
  }
  return null
}

/**
 * Runs a trial now: exact ratings are revealed and the prospect waits for a decision. With a full
 * roster, the chosen player is benched for the trial; their morale drops, and a low-morale player
 * will not re-sign at rollover. Letting the prospect go restores the benched player.
 */
export function inviteTrial(
  input: GameState,
  playerId: string,
  replaceId?: string,
): TransferOutcome {
  const error = inviteTrialError(input, playerId, replaceId)
  if (error) return { ok: false, error }
  const state = structuredClone(input)
  const player = state.players[playerId]
  state.trials ??= {}
  const trial: { season: number; week: number; benched?: BenchedPlayer } = {
    season: state.season,
    week: state.week,
  }
  if (replaceId && trialNeedsReplacement(state)) {
    const benched = state.players[replaceId]
    trial.benched = { playerId: replaceId, status: benched.status, morale: benched.morale }
    benched.status = 'inactive'
    benched.morale = Math.max(MORALE_MIN, benched.morale - BENCH_MORALE_PENALTY)
    repairLineup(state, state.currentTeamId)
  }
  state.trials[playerId] = trial
  state.trialUsage = {
    season: state.season,
    week: state.week,
    count: trialsUsedThisWeek(state) + 1,
  }
  state.inbox.unshift(
    `${player.name} finished a trial. Their exact ratings are on the scouting page: ${playerOverall(player)} overall.`,
  )
  return { ok: true, state }
}

/** Offers a contract to a prospect who has trialled, at their asking salary. */
export function negotiateTrialist(
  input: GameState,
  playerId: string,
  years: number,
): TransferOutcome {
  const player = input.players[playerId]
  if (!player) return { ok: false, error: 'That player no longer exists.' }
  if (!hasTrialed(input, playerId))
    return { ok: false, error: `${player.name} has not trialled for you yet.` }
  const max = maxRenewalYears(player)
  if (!Number.isInteger(years) || years < 1 || years > max)
    return { ok: false, error: `${player.name} will sign for 1–${max} year${max > 1 ? 's' : ''}.` }
  const state = structuredClone(input)
  state.players[playerId].years = years
  const error = signFreeAgentError(state, state.currentTeamId, playerId)
  if (error) return { ok: false, error }
  applySigning(state, state.currentTeamId, playerId)
  ensureLadder(state)
  return { ok: true, state }
}

/** Ends a trial without a contract. The prospect becomes an ordinary free agent. */
export function releaseTrialist(input: GameState, playerId: string): TransferOutcome {
  const player = input.players[playerId]
  if (!player || !hasTrialed(input, playerId))
    return { ok: false, error: 'Only a player who has trialled can be let go here.' }
  const state = structuredClone(input)
  const released = state.players[playerId]
  const benched = state.trials![playerId].benched
  delete released.ladder
  delete state.trials![playerId]
  if (benched && state.players[benched.playerId]?.teamId === state.currentTeamId) {
    const restored = state.players[benched.playerId]
    restored.status = benched.status
    restored.morale = Math.min(MORALE_MAX, benched.morale)
    repairLineup(state, state.currentTeamId)
  }
  state.inbox.unshift(`Let ${released.name} go after their trial. They are now a free agent.`)
  ensureLadder(state)
  return { ok: true, state }
}
