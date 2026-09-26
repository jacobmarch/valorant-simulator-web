import { describe, expect, test } from 'bun:test'
import {
  advanceWeek,
  createGame,
  type GameState,
  kickoffQualifiers,
  kickoffStandings,
} from '../src/game'
import type { Region } from '../src/seed'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})

const regions: Region[] = ['Americas', 'EMEA', 'Pacific', 'China']
let state = createGame('Kickoff seeding', 'eg')
for (let guard = 0; guard < 20 && state.week < 9; guard++)
  state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')

const finalWinner = (s: GameState, region: Region, label: string) =>
  s.fixtures.find(
    (fixture) =>
      fixture.phase === 'Kickoff' &&
      fixture.region === region &&
      fixture.label === label &&
      fixture.status === 'completed',
  )?.winnerId

describe('Kickoff seeding', () => {
  test('qualifiers are seeded by the final they won, not by record', () => {
    regions.forEach((region) => {
      const seeds = ['Upper Final', 'Middle Final', 'Lower Final'].map((label) =>
        finalWinner(state, region, label),
      )
      expect(kickoffQualifiers(state, region)).toEqual(seeds as string[])
      expect(kickoffStandings(state, region).slice(0, 3)).toEqual(seeds as string[])
    })
  })

  test('each Upper Final winner skips the Masters 1 Swiss stage', () => {
    const swiss = state.fixtures
      .filter((fixture) => fixture.phase === 'Masters 1' && fixture.stage === 'Swiss')
      .flatMap((fixture) => [fixture.aId, fixture.bId])
    regions.forEach((region) => {
      const [first, second, third] = kickoffQualifiers(state, region)
      expect(swiss).not.toContain(first)
      expect(swiss).toContain(second)
      expect(swiss).toContain(third)
    })
  })

  test('eliminated teams rank by how late they went out', () => {
    regions.forEach((region) => {
      const order = kickoffStandings(state, region)
      const lowerFinalLoser = state.fixtures.find(
        (fixture) =>
          fixture.phase === 'Kickoff' &&
          fixture.region === region &&
          fixture.label === 'Lower Final',
      )!
      const loser =
        lowerFinalLoser.winnerId === lowerFinalLoser.aId ? lowerFinalLoser.bId : lowerFinalLoser.aId
      expect(order[3]).toBe(loser!)
    })
  })
})
