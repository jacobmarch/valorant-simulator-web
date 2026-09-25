import { describe, expect, test } from 'bun:test'
import { createGame, simulateSeries } from '../src/game'
import { mapPool } from '../src/map-data'
import { mapFit, mapTiers, runVeto } from '../src/maps'

const poolNames = mapPool.map((map) => map.name)

describe('map ratings and tiers', () => {
  test('every team ranks the whole pool from tier 1 to tier 7', () => {
    const state = createGame('Manager', 'sen')
    for (const teamId of Object.keys(state.teams)) {
      const tiers = mapTiers(state, teamId)
      expect(Object.keys(tiers).sort()).toEqual([...poolNames].sort())
      expect(Object.values(tiers).sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
    }
  })

  test('teams do not all share the same best map', () => {
    const state = createGame('Manager', 'sen')
    const best = new Set(
      Object.keys(state.teams).map((teamId) => {
        const tiers = mapTiers(state, teamId)
        return poolNames.find((name) => tiers[name] === 1)
      }),
    )
    expect(best.size).toBeGreaterThanOrEqual(3)
  })

  test('tiers follow the current lineup', () => {
    const state = createGame('Manager', 'sen')
    const team = state.teams.sen
    const before = mapTiers(state, 'sen')
    for (const id of team.lineup) {
      state.players[id].ratings.Utility = 99
      state.players[id].ratings.Tactics = 99
    }
    const after = mapTiers(state, 'sen')
    expect(after).not.toEqual(before)
    // Bind is the pool's choke-point, utility-heavy map.
    expect(after.Bind).toBeLessThan(before.Bind)
  })

  test('veto bans and picks distinct maps in VCT order', () => {
    const state = createGame('Manager', 'sen')
    const bo3 = runVeto(state, 'sen', 'g2', 3)
    expect(bo3.steps.map((step) => step.action)).toEqual([
      'ban',
      'ban',
      'pick',
      'pick',
      'ban',
      'ban',
      'decider',
    ])
    expect(new Set(bo3.steps.map((step) => step.map)).size).toBe(7)
    expect(bo3.maps).toHaveLength(3)
    const bo5 = runVeto(state, 'sen', 'g2', 5)
    expect(bo5.maps).toHaveLength(5)
    expect(bo5.steps.filter((step) => step.action === 'ban')).toHaveLength(2)
  })

  test('teams pick maps they rate higher than their opponent and ban their weakest', () => {
    const state = createGame('Manager', 'sen')
    const { steps } = runVeto(state, 'sen', 'g2', 3)
    const tiers = { sen: mapTiers(state, 'sen'), g2: mapTiers(state, 'g2') }
    const firstPick = steps[2]
    expect(firstPick.teamId).toBe('sen')
    const pickEdge = tiers.g2[firstPick.map] - tiers.sen[firstPick.map]
    const firstBan = steps[0]
    const banEdge = tiers.g2[firstBan.map] - tiers.sen[firstBan.map]
    expect(pickEdge).toBeGreaterThan(banEdge)
  })

  test('series play the vetoed maps and record the veto', () => {
    const state = createGame('Manager', 'sen')
    const result = simulateSeries(state, 'sen', 'g2', 1)
    expect(result.vetoLog).toHaveLength(7)
    for (const map of result.maps) expect(result.veto).toContain(map.map)
    expect(result.veto.every((map) => poolNames.includes(map))).toBe(true)
  })

  test('a utility-heavy lineup gains an edge on its best map', () => {
    const state = createGame('Manager', 'sen')
    for (const id of state.teams.sen.lineup) {
      state.players[id].ratings.Utility = 95
      state.players[id].ratings.Tactics = 95
    }
    const edge = (map: string) => mapFit(state, 'sen', map) - mapFit(state, 'g2', map)
    const ranked = [...poolNames].sort((a, b) => edge(b) - edge(a))
    expect(edge(ranked[0])).toBeGreaterThan(edge(ranked[6]))
  })
})
