import type { GameState, Player, Team } from './game'
import { MAP_FIT_WEIGHT, type MapRatings, mapPool } from './map-data'

export type MapProfile = {
  aim: number
  operator: number
  utility: number
  trading: number
  clutch: number
}
export type VetoStep = { teamId: string; action: 'ban' | 'pick' | 'decider'; map: string }

// Scales raw rating gaps (roughly -10..10 points) into team-strength points.
const FIT_SCALE = 1.4
// A single map never swings a team by more than this many strength points (before MAP_FIT_WEIGHT).
const MAX_FIT = 4

const lean = (rating: number) => (rating - 5.5) / 4.5

function lineupPlayers(state: GameState, team: Team): Player[] {
  return team.lineup.map((id) => state.players[id]).filter(Boolean)
}
const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

export function mapProfile(state: GameState, team: Team): MapProfile {
  const players = lineupPlayers(state, team)
  if (!players.length) return { aim: 0, operator: 0, utility: 0, trading: 0, clutch: 0 }
  const role = (player: Player) => team.roleAssignments[player.id] ?? player.primaryRole
  const roles = new Set(players.map(role))
  const composition = (roles.has('Controller') ? 2 : -3) + (roles.has('Initiator') ? 1 : -2)
  return {
    aim: average(players.map((player) => player.ratings.Mechanics)),
    operator: Math.max(
      ...players.map((player) => player.ratings.Mechanics * 0.7 + player.ratings.Consistency * 0.3),
    ),
    utility:
      average(
        players.map((player) => player.ratings.Utility * 0.6 + player.ratings.Tactics * 0.4),
      ) + composition,
    trading: average(players.map((player) => player.ratings.Teamplay)),
    clutch: average(
      players.map((player) => player.ratings.Clutch * 0.6 + player.ratings.Consistency * 0.4),
    ),
  }
}

function leagueProfile(state: GameState): MapProfile {
  const profiles = Object.values(state.teams)
    .filter((team) => team.lineup.length)
    .map((team) => mapProfile(state, team))
  return {
    aim: average(profiles.map((profile) => profile.aim)),
    operator: average(profiles.map((profile) => profile.operator)),
    utility: average(profiles.map((profile) => profile.utility)),
    trading: average(profiles.map((profile) => profile.trading)),
    clutch: average(profiles.map((profile) => profile.clutch)),
  }
}

function fitFromProfile(profile: MapProfile, league: MapProfile, map: MapRatings) {
  const aim = profile.aim - league.aim,
    operator = profile.operator - league.operator,
    utility = profile.utility - league.utility,
    trading = profile.trading - league.trading,
    clutch = profile.clutch - league.clutch
  const fit =
    FIT_SCALE *
    (lean(map.operator) * (operator - aim) +
      lean(map.openness) * ((aim + trading) / 2 - utility) +
      lean(map.utility) * utility +
      lean(map.retakes) * (clutch - aim))
  return Math.max(-MAX_FIT, Math.min(MAX_FIT, fit))
}

export function mapByName(name: string) {
  return mapPool.find((map) => map.name === name)
}

/** Team-strength points a team gains (or loses) on this map from its lineup's shape. */
export function mapFit(state: GameState, teamId: string, mapName: string, league?: MapProfile) {
  const map = mapByName(mapName)
  const team = state.teams[teamId]
  if (!map || !team) return 0
  return (
    fitFromProfile(mapProfile(state, team), league ?? leagueProfile(state), map) * MAP_FIT_WEIGHT
  )
}

/** 1 = the team's strongest map, 7 = its weakest, recomputed from the current lineup. */
export function mapTiers(state: GameState, teamId: string, league?: MapProfile) {
  const team = state.teams[teamId]
  const reference = league ?? leagueProfile(state)
  const profile = team ? mapProfile(state, team) : undefined
  const ranked = mapPool
    .map((map) => ({ name: map.name, fit: profile ? fitFromProfile(profile, reference, map) : 0 }))
    .sort((a, b) => b.fit - a.fit || a.name.localeCompare(b.name))
  const span = Math.max(1, ranked.length - 1)
  return Object.fromEntries(
    ranked.map((entry, index) => [entry.name, 1 + Math.round((index * 6) / span)]),
  ) as Record<string, number>
}

/** Per-round probability shift for the attacking side on this map. */
export function attackerEdge(mapName: string) {
  const map = mapByName(mapName)
  return map ? lean(map.attackerSided) * 0.03 : 0.012
}

/**
 * VCT-style veto. BO3: ban, ban, pick, pick, ban, ban, decider.
 * BO5: ban, ban, pick, pick, pick, pick, decider. Team A (the higher seed) starts.
 * Each team values a map by how much better its tier is than the opponent's,
 * leaning toward its own comfort picks. `noise` (0-1 rolls) adds variety.
 */
export function runVeto(
  state: GameState,
  aId: string,
  bId: string,
  bestOf: 3 | 5,
  noise?: () => number,
): { maps: string[]; steps: VetoStep[] } {
  const league = leagueProfile(state)
  const tiers = { [aId]: mapTiers(state, aId, league), [bId]: mapTiers(state, bId, league) }
  const order: VetoStep['action'][] =
    bestOf === 5
      ? ['ban', 'ban', 'pick', 'pick', 'pick', 'pick']
      : ['ban', 'ban', 'pick', 'pick', 'ban', 'ban']
  const remaining = mapPool.map((map) => map.name)
  const steps: VetoStep[] = []
  const value = (teamId: string, map: string) => {
    const own = tiers[teamId][map],
      opponent = tiers[teamId === aId ? bId : aId][map]
    return opponent - own + (4 - own) * 0.5 + (noise ? (noise() - 0.5) * 1.5 : 0)
  }
  order.forEach((action, index) => {
    if (remaining.length <= 1) return
    const teamId = index % 2 === 0 ? aId : bId
    const scored = remaining
      .map((map) => ({ map, score: value(teamId, map) }))
      .sort((a, b) => (action === 'pick' ? b.score - a.score : a.score - b.score))
    const map = scored[0].map
    remaining.splice(remaining.indexOf(map), 1)
    steps.push({ teamId, action, map })
  })
  if (remaining.length) steps.push({ teamId: '', action: 'decider', map: remaining[0] })
  const maps = steps.filter((step) => step.action !== 'ban').map((step) => step.map)
  return { maps: maps.length ? maps : mapPool.slice(0, bestOf).map((map) => map.name), steps }
}

export function describeVeto(state: GameState, steps: VetoStep[]) {
  return steps.map((step) =>
    step.action === 'decider'
      ? `${step.map} decider`
      : `${state.teams[step.teamId]?.short ?? step.teamId} ${step.action} ${step.map}`,
  )
}
