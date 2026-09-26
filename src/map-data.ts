// Map pool and per-map ratings. Edit these numbers to change how maps play.
//
// Every rating is on a 1-10 scale where 5.5 is neutral:
// - operator: 1 = rifle map (short sightlines), 10 = Operator map (long lanes).
//   High values reward a team whose best aimer stands well above its rifles.
// - openness: 1 = tight choke points, 10 = wide open sites and mid.
//   Open maps reward raw aim and trading; choke maps reward utility and tactics.
// - utility: how much lineups, post-plant and executes matter.
//   High values reward Utility/Tactics and teams fielding a Controller and Initiator.
// - retakes: how often rounds are decided in post-plant and retake fights.
//   High values reward Clutch and Consistency.
// - attackerSided: 1 = strongly favours defenders, 10 = strongly favours attackers.
//   Changes the per-round side edge; it does not favour either team.
//
// Teams rank the pool by how well their current lineup fits these ratings;
// that ranking is their 1-7 map tier (1 = best), which drives picks and bans
// and adds a small edge on each map in the match simulation.
// Adding or removing a map here changes the pool everywhere.

export type MapRatings = {
  name: string
  operator: number
  openness: number
  utility: number
  retakes: number
  attackerSided: number
}

export const mapPool: MapRatings[] = [
  { name: 'Abyss', operator: 7, openness: 7, utility: 5, retakes: 5, attackerSided: 6 },
  { name: 'Bind', operator: 3, openness: 2, utility: 8, retakes: 4, attackerSided: 6 },
  { name: 'Breeze', operator: 9, openness: 9, utility: 4, retakes: 6, attackerSided: 5 },
  { name: 'Haven', operator: 5, openness: 5, utility: 6, retakes: 8, attackerSided: 6 },
  { name: 'Icebox', operator: 7, openness: 6, utility: 7, retakes: 7, attackerSided: 7 },
  { name: 'Lotus', operator: 4, openness: 4, utility: 7, retakes: 6, attackerSided: 5 },
  { name: 'Sunset', operator: 3, openness: 3, utility: 6, retakes: 3, attackerSided: 4 },
]

// How much map fit matters in the match simulation. 1 is the default
// (a team's best map is worth a few rounds per map over its worst),
// 2 doubles the effect, 0 turns map fit off (tiers and vetoes still work).
export const MAP_FIT_WEIGHT = 1
