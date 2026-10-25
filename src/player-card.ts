// Read-only summaries behind the player card: what a player's ratings reveal to the
// manager, and their club, contract and honour history from the career log.
import type { GameState, Player } from './game'
import { hasTrialed } from './scouting'

/** Scouting progress at which a rival or free agent's ratings become readable. */
export const SCOUT_REVEAL = 60

/**
 * Own players are always readable; everyone else needs enough scouting. Ladder prospects are the
 * exception: their exact ratings appear only after a trial, and scouting shows just a range.
 */
export function ratingsRevealed(state: GameState, player: Player) {
  if (player.ladder) return hasTrialed(state, player.id)
  return player.teamId === state.currentTeamId || player.scoutProgress >= SCOUT_REVEAL
}

export type ClubStint = { teamId: string; from: number; to: number }

/** Consecutive seasons at one club, oldest first. The current club runs up to the current season. */
export function clubStints(state: GameState, player: Player): ClubStint[] {
  const stints: ClubStint[] = []
  const add = (teamId: string, season: number) => {
    const last = stints.at(-1)
    if (last?.teamId === teamId && last.to >= season - 1) last.to = season
    else stints.push({ teamId, from: season, to: season })
  }
  ;(player.career ?? []).forEach((entry) => {
    if (entry.teamId) add(entry.teamId, entry.season)
  })
  if (player.teamId) add(player.teamId, state.season)
  return stints
}

export type ContractTerm = {
  teamId: string
  salary: number
  from: number
  to: number
  current: boolean
}

/** Contracts as runs of seasons on the same club at the same salary, oldest first. */
export function contractHistory(state: GameState, player: Player): ContractTerm[] {
  const seasons = (player.career ?? []).map((entry) => ({
    season: entry.season,
    teamId: entry.teamId,
    salary: entry.salary,
  }))
  if (player.teamId)
    seasons.push({ season: state.season, teamId: player.teamId, salary: player.salary })
  const terms: ContractTerm[] = []
  seasons.forEach(({ season, teamId, salary }) => {
    if (!teamId) return
    const last = terms.at(-1)
    if (last?.teamId === teamId && last.salary === salary && last.to >= season - 1) {
      last.to = season
      return
    }
    terms.push({ teamId, salary, from: season, to: season, current: false })
  })
  const latest = terms.at(-1)
  if (latest && player.teamId === latest.teamId && latest.to === state.season) latest.current = true
  return terms
}

export type Honour = { season: number; kind: 'title' | 'award'; label: string }

/** Titles and individual awards across the career, newest first. */
export function honours(player: Player): Honour[] {
  return (player.career ?? [])
    .flatMap((entry) => [
      ...entry.titles.map((label) => ({ season: entry.season, kind: 'title' as const, label })),
      ...entry.awards.map((label) => ({ season: entry.season, kind: 'award' as const, label })),
    ])
    .sort((a, b) => b.season - a.season)
}

/** Average combat score across every season with maps, weighted by maps played. */
export function careerAcs(player: Player) {
  const seasons = (player.career ?? []).filter((entry) => entry.acs !== null && entry.maps > 0)
  const maps = seasons.reduce((sum, entry) => sum + entry.maps, 0)
  if (!maps) return null
  return Math.round(seasons.reduce((sum, entry) => sum + (entry.acs ?? 0) * entry.maps, 0) / maps)
}
