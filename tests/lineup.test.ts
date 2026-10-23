import { beforeEach, describe, expect, test } from 'bun:test'
import { applySuggestedLineup, autoSetLineup, type GameState } from '../src/game'
import { suggestLineup } from '../src/lineup'
import { createKickoffGame } from './helpers'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

// Adds a free agent to the managed roster as a substitute, so there is a choice to make.
function addBenchPlayer(state: GameState, rating: number) {
  const team = state.teams[state.currentTeamId]
  const player = Object.values(state.players).find((candidate) => !candidate.teamId)
  if (!player) throw new Error('test save has no free agent')
  player.teamId = team.id
  player.status = 'substitute'
  player.ratings = Object.fromEntries(
    Object.keys(player.ratings).map((skill) => [skill, rating]),
  ) as typeof player.ratings
  team.playerIds.push(player.id)
  return player
}

describe('suggested lineup', () => {
  test('picks five players, none of them inactive', () => {
    const state = createKickoffGame('Manager', 'envy')
    const team = state.teams[state.currentTeamId]
    addBenchPlayer(state, 70)
    const benched = team.playerIds[0]
    state.players[benched].status = 'inactive'
    const suggestion = suggestLineup(state, team.id)
    expect(suggestion?.ids).toHaveLength(5)
    expect(suggestion?.ids).not.toContain(benched)
  })

  test('returns nothing when fewer than five players can play', () => {
    const state = createKickoffGame('Manager', 'envy')
    const team = state.teams[state.currentTeamId]
    team.playerIds.slice(0, 2).forEach((id) => {
      state.players[id].status = 'inactive'
    })
    expect(suggestLineup(state, team.id)).toBeNull()
    expect(applySuggestedLineup(state, team.id).ok).toBe(false)
  })

  test('applying it sets starters, substitutes and roles together', () => {
    const state = createKickoffGame('Manager', 'envy')
    const team = state.teams[state.currentTeamId]
    addBenchPlayer(state, 99)
    const outcome = applySuggestedLineup(state, team.id)
    if (!outcome.ok) throw new Error(outcome.error)
    const next = outcome.state.teams[team.id]
    expect(next.lineup).toHaveLength(5)
    team.playerIds.forEach((id) => {
      const expected = next.lineup.includes(id) ? 'starter' : 'substitute'
      expect(outcome.state.players[id].status).toBe(expected)
    })
    expect(Object.keys(next.roleAssignments).sort()).toEqual([...next.lineup].sort())
    // The input state is not mutated.
    expect(state.teams[team.id].lineup).not.toEqual(next.lineup)
  })
})

describe('auto-set lineup', () => {
  test('does nothing while the toggle is off', () => {
    const state = createKickoffGame('Manager', 'envy')
    addBenchPlayer(state, 99)
    expect(autoSetLineup(state)).toBe(state)
  })

  test('brings in a stronger bench player when the toggle is on', () => {
    const state = createKickoffGame('Manager', 'envy')
    const team = state.teams[state.currentTeamId]
    const bench = addBenchPlayer(state, 99)
    state.settings.autoLineup = true
    const next = autoSetLineup(state)
    expect(next.teams[team.id].lineup).toContain(bench.id)
    expect(next.players[bench.id].status).toBe('starter')
  })
})
