// Year in review. Box scores are pruned during the season, so every player's
// season line is tallied as each series is played; at rollover those lines and
// the season's brackets are condensed into a small SeasonReview that outlives
// the fixtures. The pop-up shows the newest one once, then lives on Results.
import {
  type CompetitionPhase,
  championsQualifiers,
  championshipPointsTable,
  eventFinish,
  type GameState,
  type MatchResult,
} from './game'
import type { Region } from './seed'

export type PlayerSeasonLine = {
  teamId: string
  maps: number
  kills: number
  deaths: number
  assists: number
  /** Sum of per-map ACS; divide by maps for the average. */
  acs: number
  firstKills: number
}
export type ReviewPlayer = {
  playerId: string
  name: string
  teamId: string
  role: string
  maps: number
  acs: number
  kd: number
  kills: number
  /** Stat impact, plus team success for the global and league awards. */
  score: number
}
export type ReviewEventPhase = Exclude<CompetitionPhase, 'Break' | 'Offseason'>
export type ReviewEvent = {
  phase: ReviewEventPhase
  region?: Region
  /** Finishing order by bracket placement; Kickoff's are the three Masters seeds. */
  podium: string[]
}
export type ReviewPlacement = { phase: ReviewEventPhase; place: string }
export type LeagueReview = {
  region: Region
  kickoff: string[]
  stage1: string[]
  stage2: string[]
  champions: string[]
  points: Array<{ teamId: string; points: number; wins: number; losses: number }>
  mvp: ReviewPlayer | null
}
export type SeasonReview = {
  season: number
  teamId: string
  record: { wins: number; losses: number; mapWins: number; mapLosses: number }
  championshipPoints: number
  placements: ReviewPlacement[]
  teamMvp: ReviewPlayer | null
  keyPlayers: ReviewPlayer[]
  globalMvp: ReviewPlayer | null
  events: ReviewEvent[]
  leagues: LeagueReview[]
}

export const REVIEW_LIMIT = 10
const regions: Region[] = ['Americas', 'EMEA', 'Pacific', 'China']
const phases: ReviewEventPhase[] = [
  'Kickoff',
  'Masters 1',
  'Stage 1',
  'Masters 2',
  'Stage 2',
  'Champions',
]
const internationalPhases = new Set<ReviewEventPhase>(['Masters 1', 'Masters 2', 'Champions'])
const placeLabels = ['1st', '2nd', '3rd', '4th', '5th–6th', '5th–6th', '7th–8th', '7th–8th']
/** Titles weigh on the global MVP the way they do in real award voting. */
const TITLE_BONUS: Partial<Record<ReviewEventPhase, number>> = {
  'Masters 1': 10,
  'Masters 2': 10,
  Champions: 25,
}

/** Adds one series' box score to each player's season line. */
export function recordSeasonStats(state: GameState, match: MatchResult) {
  state.seasonStats ??= {}
  const lines = state.seasonStats
  match.maps.forEach((map) =>
    Object.entries(map.stats).forEach(([id, stat]) => {
      const teamId = state.players[id]?.teamId ?? lines[id]?.teamId
      if (!teamId) return
      const line = (lines[id] ??= {
        teamId,
        maps: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        acs: 0,
        firstKills: 0,
      })
      line.teamId = teamId
      line.maps++
      line.kills += stat.kills
      line.deaths += stat.deaths
      line.assists += stat.assists
      line.acs += stat.acs
      line.firstKills += stat.firstKills
    }),
  )
}

/** Rebuilds season lines from the season's surviving box scores (for older saves). */
export function backfillSeasonStats(state: GameState) {
  state.seasonStats = {}
  ;[...state.matches]
    .reverse()
    .filter((match) => match.season === state.season)
    .forEach((match) => recordSeasonStats(state, match))
}

/** Per-map impact: average combat score, nudged by trading well and opening rounds. */
function impact(line: PlayerSeasonLine) {
  const acs = line.acs / line.maps
  const kd = line.deaths ? line.kills / line.deaths : line.kills
  return acs + 60 * (Math.min(kd, 2) - 1) + 15 * (line.firstKills / line.maps)
}

function reviewPlayer(state: GameState, id: string, line: PlayerSeasonLine, bonus = 0) {
  const player = state.players[id]
  return {
    playerId: id,
    name: player?.name ?? 'Unknown',
    teamId: line.teamId,
    role: player?.primaryRole ?? '',
    maps: line.maps,
    acs: Math.round(line.acs / line.maps),
    kd: Math.round((line.deaths ? line.kills / line.deaths : line.kills) * 100) / 100,
    kills: line.kills,
    score: Math.round((impact(line) + bonus) * 10) / 10,
  } satisfies ReviewPlayer
}

/** Players with enough maps to count, best first. The bar is a third of the busiest player's maps. */
function ranked(state: GameState, filter: (line: PlayerSeasonLine) => boolean, bonus = false) {
  const entries = Object.entries(state.seasonStats ?? {}).filter(([, line]) => filter(line))
  const busiest = Math.max(0, ...entries.map(([, line]) => line.maps))
  const bonuses = bonus ? teamSuccess(state) : {}
  return entries
    .filter(([, line]) => line.maps >= Math.max(1, busiest / 3))
    .map(([id, line]) => reviewPlayer(state, id, line, bonuses[line.teamId] ?? 0))
    .sort((a, b) => b.score - a.score || b.maps - a.maps)
}

function teamSuccess(state: GameState) {
  const bonus: Record<string, number> = {}
  Object.values(state.teams).forEach((team) => {
    bonus[team.id] = team.championshipPoints * 1.5
  })
  phases.forEach((phase) => {
    const winner = internationalPhases.has(phase) ? eventFinish(state, phase)[0] : undefined
    if (winner) bonus[winner] = (bonus[winner] ?? 0) + (TITLE_BONUS[phase] ?? 0)
  })
  return bonus
}

const settled = (finish: Array<string | undefined>) =>
  finish.filter((id): id is string => Boolean(id))

function placementFor(state: GameState, phase: ReviewEventPhase, teamId: string, region: Region) {
  const finish = internationalPhases.has(phase)
    ? eventFinish(state, phase)
    : eventFinish(state, phase, region)
  const index = finish.indexOf(teamId)
  if (index >= 0)
    return phase === 'Kickoff' && index < 3 ? `Masters seed #${index + 1}` : placeLabels[index]
  const played = state.fixtures.filter(
    (fixture) =>
      fixture.season === state.season &&
      fixture.phase === phase &&
      fixture.status === 'completed' &&
      (fixture.aId === teamId || fixture.bId === teamId),
  )
  if (!played.length) return internationalPhases.has(phase) ? 'Did not qualify' : 'Did not play'
  const last = played.at(-1)
  if (last?.stage === 'Playoffs') return 'Playoffs'
  if (last?.stage === 'Swiss') return 'Swiss stage'
  if (last?.stage === 'Groups' || last?.stage === 'League') return 'Group stage'
  return 'Eliminated'
}

/** Condenses the finishing season. Call before rollover resets records and points. */
export function buildSeasonReview(state: GameState): SeasonReview {
  const team = state.teams[state.currentTeamId]
  const points = championshipPointsTable(state)
  const teamRanked = ranked(state, (line) => line.teamId === team.id)
  const events: ReviewEvent[] = []
  phases.forEach((phase) => {
    if (internationalPhases.has(phase))
      events.push({ phase, podium: settled(eventFinish(state, phase)).slice(0, 4) })
    else
      regions.forEach((region) =>
        events.push({
          phase,
          region,
          podium: settled(eventFinish(state, phase, region)).slice(0, 4),
        }),
      )
  })
  const podium = (phase: ReviewEventPhase, region: Region) =>
    events.find((event) => event.phase === phase && event.region === region)?.podium ?? []
  return {
    season: state.season,
    teamId: team.id,
    record: {
      wins: team.wins,
      losses: team.losses,
      mapWins: team.mapWins,
      mapLosses: team.mapLosses,
    },
    championshipPoints: points[team.id]?.total ?? team.championshipPoints,
    placements: phases.map((phase) => ({
      phase,
      place: placementFor(state, phase, team.id, team.region),
    })),
    teamMvp: teamRanked[0] ?? null,
    keyPlayers: teamRanked.slice(1, 4),
    globalMvp: ranked(state, () => true, true)[0] ?? null,
    events,
    leagues: regions.map((region) => ({
      region,
      kickoff: podium('Kickoff', region).slice(0, 3),
      stage1: podium('Stage 1', region),
      stage2: podium('Stage 2', region),
      champions: championsQualifiers(state, region),
      points: Object.values(state.teams)
        .filter((candidate) => candidate.region === region)
        .map((candidate) => ({
          teamId: candidate.id,
          points: points[candidate.id]?.total ?? 0,
          wins: candidate.wins,
          losses: candidate.losses,
        }))
        .sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses)
        .slice(0, 6),
      mvp: ranked(state, (line) => state.teams[line.teamId]?.region === region, true)[0] ?? null,
    })),
  }
}

/** Stores the finished season's review and flags it for the pop-up. */
export function closeSeasonReview(state: GameState) {
  const review = buildSeasonReview(state)
  state.reviews = [
    review,
    ...(state.reviews ?? []).filter((r) => r.season !== review.season),
  ].slice(0, REVIEW_LIMIT)
  state.pendingReview = review.season
  state.seasonStats = {}
  return review
}

export const eventName = (event: { phase: ReviewEventPhase; region?: Region }) =>
  event.phase === 'Champions'
    ? 'Champions'
    : event.region
      ? `${event.region} ${event.phase}`
      : event.phase
