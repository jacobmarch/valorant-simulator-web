import { beforeEach, describe, expect, test } from 'bun:test'
import { createGame, teamStrength } from '../src/game'
import {
  CORE_ROLES,
  MISSING_ROLE_PENALTY,
  OFF_ROLE_PENALTY,
  SECONDARY_ROLE_PENALTY,
  bestRoleAssignment,
  missingRoles,
  rolePenalty,
} from '../src/roles'
import { repairLineup } from '../src/transfers'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

describe('lineup roles', () => {
  test('off-role penalty is -5 on a secondary role and -10 otherwise', () => {
    const state = createGame('Manager', 'c9')
    const player = Object.values(state.players).find(
      (candidate) => candidate.primaryRole !== 'Flex' && candidate.secondaryRoles.length,
    )!
    const secondary = player.secondaryRoles[0]
    const unlisted = CORE_ROLES.find(
      (role) => role !== player.primaryRole && !player.secondaryRoles.includes(role),
    )!
    expect(rolePenalty(player, player.primaryRole)).toBe(0)
    expect(rolePenalty(player, secondary)).toBe(SECONDARY_ROLE_PENALTY)
    expect(rolePenalty(player, unlisted)).toBe(OFF_ROLE_PENALTY)
  })

  test('only the four core roles are required', () => {
    expect(missingRoles(['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Duelist'])).toEqual([])
    expect(missingRoles(['Duelist', 'Duelist', 'Initiator', 'Sentinel', 'Flex'])).toEqual([
      'Controller',
    ])
  })

  test('moving a player off role costs their rating and any role left uncovered', () => {
    const state = createGame('Manager', 'c9')
    const team = state.teams.c9
    const base = teamStrength(state, 'c9')
    const controller = team.lineup.find((id) => team.roleAssignments[id] === 'Controller')!
    const player = state.players[controller]
    const duelistPenalty = rolePenalty(player, 'Duelist')
    team.roleAssignments[controller] = 'Duelist'
    expect(teamStrength(state, 'c9')).toBeCloseTo(
      base + duelistPenalty / team.lineup.length + MISSING_ROLE_PENALTY,
    )
  })

  test('AI teams re-slot roles to cover every core role', () => {
    const state = createGame('Manager', 'c9')
    const team = state.teams.sen
    const controller = team.lineup.find((id) => team.roleAssignments[id] === 'Controller')!
    state.players[controller].primaryRole = 'Duelist'
    state.players[controller].secondaryRoles = []
    team.roleAssignments = {}
    repairLineup(state, 'sen')
    expect(missingRoles(Object.values(team.roleAssignments))).toEqual([])
  })

  test('best assignment keeps primary roles when they already cover the core', () => {
    const state = createGame('Manager', 'c9')
    const players = state.teams.sen.lineup.map((id) => state.players[id])
    const assignment = bestRoleAssignment(players)
    players.forEach((player) => {
      expect(rolePenalty(player, assignment[player.id])).toBe(0)
    })
  })
})
