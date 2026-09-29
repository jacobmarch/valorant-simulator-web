import { beforeEach, describe, expect, test } from 'bun:test'
import { createGame, loadGame, rolloverSeason, teamStrength } from '../src/game'
import {
  IGL_BONUS,
  IGL_EXTRA_SLOTS,
  IGL_TEAM_TARGET,
  IGL_THRESHOLD,
  NO_IGL_PENALTY,
  gameSense,
  qualifiesAsIgl,
} from '../src/igl'

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
  test('most teams have an IGL, at most one designated per team plus a few extras', () => {
    const state = createGame('Manager', 'c9')
    const players = Object.values(state.players)
    const igls = players.filter((player) => player.igl)
    igls.forEach((player) => expect(qualifiesAsIgl(player.ratings)).toBeTrue())
    const teamsWithIgl = Object.values(state.teams).filter((team) =>
      team.playerIds.some((id) => state.players[id].igl),
    )
    expect(teamsWithIgl.length).toBeGreaterThanOrEqual(32)
    expect(teamsWithIgl.length).toBeLessThanOrEqual(IGL_TEAM_TARGET)
    expect(igls.length).toBeLessThanOrEqual(IGL_TEAM_TARGET + IGL_EXTRA_SLOTS)
  })

  test('the trait is capped league-wide even when many players qualify', () => {
    const state = createGame('Manager', 'c9')
    Object.values(state.players).forEach((player) => {
      player.ratings.Tactics = 95
      player.ratings.Teamplay = 95
    })
    rolloverSeason(state)
    const igls = Object.values(state.players).filter((player) => player.igl)
    expect(igls).toHaveLength(IGL_TEAM_TARGET + IGL_EXTRA_SLOTS)
    const teams = new Set(igls.map((player) => player.teamId).filter(Boolean))
    expect(teams.size).toBeGreaterThanOrEqual(IGL_TEAM_TARGET)
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
    const players = Object.values(state.players)
    players.forEach((player) => {
      player.ratings.Tactics = 70
      player.ratings.Teamplay = 70
      player.igl = false
    })
    const [riser, veteran, hopeful] = players
    riser.ratings.Tactics = IGL_THRESHOLD + 2
    riser.ratings.Teamplay = IGL_THRESHOLD + 2
    veteran.igl = true
    veteran.ratings.Tactics = IGL_THRESHOLD - 1
    veteran.ratings.Teamplay = IGL_THRESHOLD - 1
    hopeful.ratings.Tactics = IGL_THRESHOLD - 1
    hopeful.ratings.Teamplay = IGL_THRESHOLD - 1
    rolloverSeason(state)
    expect(riser.igl).toBe(true)
    expect(gameSense(veteran.ratings)).toBeLessThan(IGL_THRESHOLD)
    expect(veteran.igl).toBe(true)
    expect(hopeful.igl).toBe(false)
  })

  test('version 14 saves gain IGLs on load', () => {
    const legacy = createGame('Manager', 'c9') as any
    legacy.version = 14
    Object.values(legacy.players).forEach((player: any) => {
      delete player.igl
    })
    memory.set('vct-manager-mvp-save-v1', JSON.stringify(legacy))
    const loaded = loadGame()!
    expect(loaded.version).toBe(17)
    const igls = Object.values(loaded.players).filter((player) => player.igl)
    expect(igls.length).toBeGreaterThan(0)
    expect(igls.length).toBeLessThanOrEqual(IGL_TEAM_TARGET + IGL_EXTRA_SLOTS)
    igls.forEach((player) => {
      expect(qualifiesAsIgl(player.ratings)).toBeTrue()
    })
  })
})
