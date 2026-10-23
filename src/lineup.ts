import { conditionBonus } from './development'
import type { GameState, Player } from './game'
import { iglAdjustment } from './igl'
import { bestRoleAssignment, compositionPenalty, roleRating } from './roles'
import type { Role } from './seed'

export const LINEUP_SIZE = 5

export type LineupSuggestion = {
  ids: string[]
  roles: Record<string, Role>
  strength: number
}

// Same formula as teamStrength in game.ts, for a five that has not been put on the team yet.
export function lineupStrength(players: Player[], roles: Record<string, Role>) {
  const assigned = players.map((player) => roles[player.id])
  return (
    players.reduce(
      (sum, player, index) => sum + roleRating(player, assigned[index]) + conditionBonus(player),
      0,
    ) /
      players.length +
    compositionPenalty(assigned) +
    iglAdjustment(players)
  )
}

// Tries every five from the available roster (up to ten players, so at most 252 groups) and
// keeps the one with the highest team strength. Inactive players are never picked.
export function suggestLineup(state: GameState, teamId: string): LineupSuggestion | null {
  const pool = state.teams[teamId].playerIds
    .map((id) => state.players[id])
    .filter((player) => player && player.status !== 'inactive')
  if (pool.length < LINEUP_SIZE) return null
  // Held in an object so the closure's writes are visible to TypeScript after the search.
  const found: { best: LineupSuggestion | null } = { best: null }
  const group: Player[] = []
  const choose = (start: number) => {
    if (group.length === LINEUP_SIZE) {
      const roles = bestRoleAssignment(group)
      const strength = lineupStrength(group, roles)
      if (!found.best || strength > found.best.strength)
        found.best = { ids: group.map((player) => player.id), roles, strength }
      return
    }
    for (let index = start; index < pool.length; index++) {
      group.push(pool[index])
      choose(index + 1)
      group.pop()
    }
  }
  choose(0)
  return found.best
}
