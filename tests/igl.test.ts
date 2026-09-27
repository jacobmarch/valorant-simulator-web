import { beforeEach, describe, expect, test } from 'bun:test'
import { createGame, loadGame, rolloverSeason, teamStrength } from '../src/game'
import { IGL_BONUS, IGL_THRESHOLD, NO_IGL_PENALTY, gameSense, qualifiesAsIgl } from '../src/igl'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

describe('in-game leaders', () => {
  test('only strong Tactics and Teamplay players are IGLs', () => {
    const state = createGame('Manager', 'c9')
    const players = Object.values(state.players)
    const igls = players.filter((player) => player.igl)
    expect(igls.length).toBeGreaterThan(0)
    expect(igls.length).toBeLessThan(players.length * 0.2)
    players.forEach((player) => {
      expect(player.igl).toBe(qualifiesAsIgl(player.ratings))
    })
  })

  test('an IGL in the starting five adds the bonus; none costs the penalty', () => {
    const state = createGame('Manager', 'c9')
    const team = state.teams.c9
    const lineup = team.lineup.map((id) => state.players[id])
    lineup.forEach((player) => {
      player.igl = false
    })
    const without = teamStrength(state, 'c9')
    lineup[0].igl = true
    expect(teamStrength(state, 'c9')).toBeCloseTo(without - NO_IGL_PENALTY + IGL_BONUS)
    lineup[1].igl = true
    expect(teamStrength(state, 'c9')).toBeCloseTo(without - NO_IGL_PENALTY + IGL_BONUS)
  })

  test('a benched IGL does not count', () => {
    const state = createGame('Manager', 'c9')
    const team = state.teams.c9
    Object.values(state.players).forEach((player) => {
      player.igl = false
    })
    const without = teamStrength(state, 'c9')
    const bench = team.playerIds.find((id) => !team.lineup.includes(id))
    if (bench) state.players[bench].igl = true
    expect(teamStrength(state, 'c9')).toBeCloseTo(without)
  })

  test('players grow into the trait at season rollover and keep it with some slack', () => {
    const state = createGame('Manager', 'c9')
    const riser = Object.values(state.players).find((player) => !player.igl)!
    riser.ratings.Tactics = IGL_THRESHOLD + 2
    riser.ratings.Teamplay = IGL_THRESHOLD + 2
    const veteran = Object.values(state.players).find((player) => player.igl)!
    veteran.ratings.Tactics = IGL_THRESHOLD - 1
    veteran.ratings.Teamplay = IGL_THRESHOLD - 1
    rolloverSeason(state)
    expect(riser.igl).toBe(true)
    expect(gameSense(veteran.ratings)).toBeLessThan(IGL_THRESHOLD)
    expect(veteran.igl).toBe(true)
  })

  test('version 14 saves gain IGLs on load', () => {
    const legacy = createGame('Manager', 'c9') as any
    legacy.version = 14
    Object.values(legacy.players).forEach((player: any) => {
      delete player.igl
    })
    memory.set('vct-manager-mvp-save-v1', JSON.stringify(legacy))
    const loaded = loadGame()!
    expect(loaded.version).toBe(15)
    Object.values(loaded.players).forEach((player) => {
      expect(player.igl).toBe(qualifiesAsIgl(player.ratings))
    })
  })
})
