import { overallRating } from './development'
import type { Player } from './game'
import { type Role, roles } from './seed'

// The four roles every lineup needs; Flex is optional.
export const CORE_ROLES: Role[] = ['Duelist', 'Initiator', 'Controller', 'Sentinel']
// Rating points a player loses on a role they list as secondary, or don't list at all.
export const SECONDARY_ROLE_PENALTY = -5
export const OFF_ROLE_PENALTY = -10
// Team rating points lost for each core role nobody in the lineup is assigned.
export const MISSING_ROLE_PENALTY = -3

export function rolePenalty(player: Player, role: Role) {
  if (role === player.primaryRole) return 0
  // A natural Flex is comfortable anywhere.
  if (player.primaryRole === 'Flex') return 0
  return player.secondaryRoles.includes(role) ? SECONDARY_ROLE_PENALTY : OFF_ROLE_PENALTY
}

export function roleRating(player: Player, role: Role) {
  return overallRating(player.ratings) + rolePenalty(player, role)
}

export function missingRoles(assigned: Role[]) {
  return CORE_ROLES.filter((role) => !assigned.includes(role))
}

export function compositionPenalty(assigned: Role[]) {
  return missingRoles(assigned).length * MISSING_ROLE_PENALTY
}

// Best role for each lineup player: covers every core role at the lowest total
// comfort cost, keeping primary roles when that is free. Used for AI teams.
export function bestRoleAssignment(players: Player[]): Record<string, Role> {
  let best: Role[] = players.map((player) => player.primaryRole)
  let bestScore = score(players, best)
  const current: Role[] = []
  const search = (index: number) => {
    if (index === players.length) {
      const value = score(players, current)
      if (value > bestScore) {
        bestScore = value
        best = [...current]
      }
      return
    }
    for (const role of roles) {
      current[index] = role
      search(index + 1)
    }
  }
  if (players.length <= 6) search(0)
  return Object.fromEntries(players.map((player, index) => [player.id, best[index]]))
}

function score(players: Player[], assigned: Role[]) {
  return (
    players.reduce((sum, player, index) => sum + rolePenalty(player, assigned[index]), 0) /
      Math.max(1, players.length) +
    compositionPenalty(assigned)
  )
}
