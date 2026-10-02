import { beforeEach, describe, expect, test } from 'bun:test'
import {
  ageDeclineChance,
  ageGrowthMultiplier,
  agePlayer,
  developPlayer,
  FORM_LIMIT,
  formAfterSeries,
  MORALE_MAX,
  MORALE_MIN,
  moraleAfterSeries,
  overshootDeclineChance,
  potentialFactor,
  prospectPotential,
  retirementChance,
  weeklyMorale,
} from '../src/development'
import { createGame, loadGame, SAVE_KEY, simulateSeries, teamStrength } from '../src/game'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

const seededRandom = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
const ratings = (value: number) => ({
  Mechanics: value,
  Tactics: value,
  Utility: value,
  Consistency: value,
  Clutch: value,
  Teamplay: value,
})
const heavyTraining = {
  Mechanics: 10,
  Tactics: 6,
  Utility: 6,
  Consistency: 6,
  Clutch: 6,
  Teamplay: 6,
}
const trainFor = (age: number, potential: number, weeks: number) => {
  const player = {
    ratings: ratings(70),
    age,
    potential,
    form: 0,
    morale: 60,
    status: 'starter' as const,
  }
  const random = seededRandom(7)
  for (let week = 0; week < weeks; week++) developPlayer(player, heavyTraining, random)
  return player
}

describe('player development', () => {
  test('young players with headroom grow faster than veterans', () => {
    const young = trainFor(19, 90, 40)
    const veteran = trainFor(31, 90, 40)
    expect(young.ratings.Mechanics).toBeGreaterThan(veteran.ratings.Mechanics)
    expect(ageGrowthMultiplier(19)).toBeGreaterThan(ageGrowthMultiplier(31))
  })
  test('growth nearly stops once a player reaches potential', () => {
    expect(potentialFactor(70, 70)).toBeLessThan(0.1)
    expect(potentialFactor(70, 80)).toBe(1)
    const capped = trainFor(22, 70, 40)
    const open = trainFor(22, 90, 40)
    expect(open.ratings.Mechanics).toBeGreaterThan(capped.ratings.Mechanics)
  })
  test('aging erodes mechanics before tactical skills', () => {
    expect(ageDeclineChance(25, 'Mechanics')).toBe(0)
    expect(ageDeclineChance(27, 'Mechanics')).toBeGreaterThan(0)
    expect(ageDeclineChance(28, 'Tactics')).toBe(0)
    expect(ageDeclineChance(30, 'Tactics')).toBeGreaterThan(0)
    expect(ageDeclineChance(30, 'Mechanics')).toBeGreaterThan(ageDeclineChance(30, 'Tactics'))
  })
  test('a season birthday lowers potential from the mid-twenties, faster with age', () => {
    const young = {
      ratings: ratings(70),
      age: 20,
      potential: 85,
      form: 0,
      morale: 60,
      status: 'starter' as const,
    }
    const prime = { ...young, ratings: ratings(70), age: 26 }
    const veteran = { ...young, ratings: ratings(70), age: 31 }
    agePlayer(young)
    agePlayer(prime)
    agePlayer(veteran)
    expect(young).toMatchObject({ age: 21, potential: 85 })
    expect(prime).toMatchObject({ age: 27, potential: 84 })
    expect(veteran).toMatchObject({ age: 32, potential: 82 })
  })
  test('players stop growing at their ceiling and slide back once past it', () => {
    expect(potentialFactor(80, 80)).toBe(0)
    expect(overshootDeclineChance(80, 80)).toBe(0)
    expect(overshootDeclineChance(84, 80)).toBeGreaterThan(overshootDeclineChance(82, 80))
    const player = {
      ratings: ratings(85),
      age: 24,
      potential: 78,
      form: 0,
      morale: 60,
      status: 'starter' as const,
    }
    const random = seededRandom(7)
    for (let week = 0; week < 52; week++) developPlayer(player, heavyTraining, random)
    expect(Math.max(...Object.values(player.ratings))).toBeLessThan(85)
  })
  test('star prospects are rare', () => {
    const ceilings = Array.from({ length: 1000 }, (_, index) => prospectPotential(64, index / 1000))
    const stars = ceilings.filter((value) => value >= 88).length
    expect(stars).toBeGreaterThan(40)
    expect(stars).toBeLessThan(150)
    expect(ceilings.filter((value) => value >= 90).length).toBeLessThan(stars)
    expect(Math.max(...ceilings)).toBeLessThanOrEqual(94)
  })
  test('retirement comes with age, and sooner for players nobody signs', () => {
    expect(retirementChance(24, 85, false)).toBe(0)
    expect(retirementChance(30, 80, false)).toBeGreaterThan(retirementChance(27, 80, false))
    expect(retirementChance(34, 80, false)).toBeGreaterThan(0.5)
    expect(retirementChance(26, 68, true)).toBeGreaterThan(retirementChance(26, 68, false))
    expect(retirementChance(18, 60, true)).toBe(0)
  })
  test('form and morale respond to results and stay bounded', () => {
    expect(formAfterSeries(0, 260, true)).toBeGreaterThan(0)
    expect(formAfterSeries(0, 150, false)).toBeLessThan(0)
    expect(formAfterSeries(FORM_LIMIT, 400, true)).toBe(FORM_LIMIT)
    expect(moraleAfterSeries(60, true)).toBe(64)
    expect(moraleAfterSeries(60, false)).toBe(55)
    expect(moraleAfterSeries(MORALE_MAX, true)).toBe(MORALE_MAX)
    expect(moraleAfterSeries(MORALE_MIN, false)).toBe(MORALE_MIN)
    expect(weeklyMorale(60, 'substitute')).toBe(58)
  })
})

describe('development in the game', () => {
  test('seeded players have ages and potential at or above their overall', () => {
    const state = createGame('Manager', 'c9')
    Object.values(state.players).forEach((player) => {
      const overall = Object.values(player.ratings).reduce((a, b) => a + b, 0) / 6
      expect(player.age).toBeGreaterThanOrEqual(17)
      expect(player.age).toBeLessThanOrEqual(30)
      expect(player.potential).toBeGreaterThanOrEqual(Math.round(overall))
    })
  })
  test('a series updates form and morale for both lineups', () => {
    const state = createGame('Manager', 'c9')
    const result = simulateSeries(state, 'c9', 'sen', 1)
    const winner = state.teams[result.winnerId]
    const loser = state.teams[result.winnerId === 'c9' ? 'sen' : 'c9']
    winner.lineup.forEach((id) => expect(state.players[id].morale).toBe(64))
    loser.lineup.forEach((id) => expect(state.players[id].morale).toBe(55))
    expect([...winner.lineup, ...loser.lineup].some((id) => state.players[id].form !== 0)).toBe(
      true,
    )
  })
  test('morale and form feed team strength', () => {
    const state = createGame('Manager', 'c9')
    const base = teamStrength(state, 'c9')
    state.teams.c9.lineup.forEach((id) => {
      state.players[id].morale = 90
      state.players[id].form = 4
    })
    expect(teamStrength(state, 'c9')).toBeCloseTo(base + 4 + (90 - 60) / 25)
  })
  test('version 9 saves gain development fields on load', () => {
    const legacy = createGame('Manager', 'c9') as any
    legacy.version = 9
    Object.values(legacy.players).forEach((player: any) => {
      delete player.potential
      delete player.morale
    })
    localStorage.setItem(SAVE_KEY, JSON.stringify(legacy))
    const migrated = loadGame()!
    expect(migrated.version).toBe(18)
    Object.values(migrated.players).forEach((player) => {
      expect(player.age).toBeGreaterThanOrEqual(17)
      expect(player.potential).toBeGreaterThan(0)
      expect(player.morale).toBe(60)
    })
  })
})
