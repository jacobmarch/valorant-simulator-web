// In-game leaders: players whose tactical understanding and team play are strong
// enough to call for the team. All IGL tuning lives here.
import type { Player, Ratings } from './game'

// Game sense (average of Tactics and Teamplay) a player needs to earn the IGL trait.
// Roughly the top 12% of seeded pros clear it.
export const IGL_THRESHOLD = 82
// An IGL keeps the trait until game sense drops this far below the threshold.
export const IGL_KEEP_MARGIN = 3
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

/** Sets or clears the trait from current ratings. Existing IGLs get some slack. */
export function refreshIgl(player: Player) {
  const sense = gameSense(player.ratings)
  player.igl = player.igl ? sense >= IGL_THRESHOLD - IGL_KEEP_MARGIN : sense >= IGL_THRESHOLD
  return player.igl
}

export function iglAdjustment(lineup: Player[]) {
  if (!lineup.length) return 0
  return lineup.some((player) => player.igl) ? IGL_BONUS : NO_IGL_PENALTY
}
