// In-game leaders: the few players whose tactical understanding and team play are
// strong enough to call for a team. All IGL tuning lives here.
import type { Player, Ratings } from './game'

// Game sense (average of Tactics and Teamplay) a player needs to be considered at all.
export const IGL_THRESHOLD = 76
// A premium trait, but not a rare one: the best shot-caller on this many teams holds it
// (one per team), so most playoff teams have one. Drifts lower when too few clear the bar.
export const IGL_TEAM_TARGET = 38
// Extra IGLs beyond one per team: the next best callers, whether unsigned or on a bench,
// who are available for teams to sign or buy out.
export const IGL_EXTRA_SLOTS = 7
// Incumbent IGLs get this much game sense of slack in the ranking so the trait does not
// flicker between players on a one-point swing.
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
  const ranked = players
    .filter((player) => player.status !== 'retired' && standing(player) >= IGL_THRESHOLD)
    .sort((a, b) => standing(b) - standing(a) || a.id.localeCompare(b.id))
  const leaders = new Set<string>()
  const ledTeams = new Set<string>()
  // First pass: the best caller on each team, best teams' callers first.
  ranked.forEach((player) => {
    if (!player.teamId || ledTeams.has(player.teamId) || ledTeams.size >= IGL_TEAM_TARGET) return
    ledTeams.add(player.teamId)
    leaders.add(player.id)
  })
  // Second pass: the best remaining callers are available on the market or the bench.
  let extras = 0
  ranked.forEach((player) => {
    if (leaders.has(player.id) || extras >= IGL_EXTRA_SLOTS) return
    leaders.add(player.id)
    extras++
  })
  players.forEach((player) => {
    player.igl = leaders.has(player.id)
  })
}

export function iglAdjustment(lineup: Player[]) {
  if (!lineup.length) return 0
  return lineup.some((player) => player.igl) ? IGL_BONUS : NO_IGL_PENALTY
}
