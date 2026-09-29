// In-game leaders: the few players whose tactical understanding and team play are
// strong enough to call for a team. All IGL tuning lives here.
import type { Player, Ratings } from './game'

// Game sense (average of Tactics and Teamplay) a player needs to be considered at all.
export const IGL_THRESHOLD = 84
// The trait is scarce: only this many players in the whole league hold it at once,
// the best by game sense. With 48 teams that is about one team in five.
export const IGL_SLOTS = 10
// Incumbent IGLs get this much game sense of slack, both for the floor and the ranking,
// so the trait does not flicker between players on a one-point swing.
export const IGL_KEEP_MARGIN = 2
// Team rating points for having an IGL in the starting five (does not stack).
export const IGL_BONUS = 2
// Team rating points lost when nobody in the starting five is an IGL.
export const NO_IGL_PENALTY = -1

export function gameSense(ratings: Ratings) {
  return (ratings.Tactics + ratings.Teamplay) / 2
}

export function qualifiesAsIgl(ratings: Ratings) {
  return gameSense(ratings) >= IGL_THRESHOLD
}

/** Re-awards the trait across the league from current ratings. Mutates `igl`. */
export function refreshIgls(players: Player[]) {
  const standing = (player: Player) =>
    gameSense(player.ratings) + (player.igl ? IGL_KEEP_MARGIN : 0)
  const leaders = new Set(
    players
      .filter((player) => player.status !== 'retired' && standing(player) >= IGL_THRESHOLD)
      .sort((a, b) => standing(b) - standing(a) || a.id.localeCompare(b.id))
      .slice(0, IGL_SLOTS)
      .map((player) => player.id),
  )
  players.forEach((player) => {
    player.igl = leaders.has(player.id)
  })
}

export function iglAdjustment(lineup: Player[]) {
  if (!lineup.length) return 0
  return lineup.some((player) => player.igl) ? IGL_BONUS : NO_IGL_PENALTY
}
