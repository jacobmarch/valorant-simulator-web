import { beforeEach, describe, expect, test } from 'bun:test'
import { advanceWeek, createGame, type GameState } from '../src/game'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

const advance = (weeks: number) => {
  let state = createGame('Manager', 'c9')
  for (let week = 0; week < weeks; week++)
    state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
  return state
}
const pairKey = (aId: string, bId: string | null) => [aId, bId].sort().join('|')
// Every series in `dropLabel` pairs two teams that never met in `priorLabels` of the same event.
const rematches = (
  state: GameState,
  phase: string,
  dropLabel: string,
  priorLabels: string[],
  region?: string,
) => {
  const event = state.fixtures.filter(
    (fixture) =>
      fixture.phase === phase && fixture.bId && (!region || fixture.region === region),
  )
  const met = new Set(
    event
      .filter((fixture) => priorLabels.includes(fixture.label))
      .map((fixture) => pairKey(fixture.aId, fixture.bId)),
  )
  const drops = event.filter((fixture) => fixture.label === dropLabel)
  expect(drops.length).toBeGreaterThan(0)
  return drops.filter((fixture) => met.has(pairKey(fixture.aId, fixture.bId)))
}

describe('lower bracket crossover', () => {
  test('Masters upper semifinal losers drop to the opposite side of the lower bracket', {
    timeout: 20000,
  }, () => {
    for (let run = 0; run < 3; run++) {
      const state = advance(10)
      expect(
        rematches(state, 'Masters 1', 'Lower Round 2', [
          'Upper Quarterfinal',
          'Upper Semifinal',
          'Lower Round 1',
        ]),
      ).toHaveLength(0)
    }
  })
  test('Champions upper semifinal losers drop to the opposite side of the lower bracket', {
    timeout: 20000,
  }, () => {
    const state = advance(42)
    expect(
      rematches(state, 'Champions', 'Lower Round 2', [
        'Upper Quarterfinal',
        'Upper Semifinal',
        'Lower Round 1',
      ]),
    ).toHaveLength(0)
  })
  test('Kickoff drops avoid pairing teams that just met', { timeout: 20000 }, () => {
    for (let run = 0; run < 3; run++) {
      const state = advance(7)
      ;(['Americas', 'EMEA', 'Pacific', 'China'] as const).forEach((region) => {
        expect(
          rematches(state, 'Kickoff', 'Middle Round 1', ['Upper Round 1', 'Upper Round 2'], region),
        ).toHaveLength(0)
        expect(
          rematches(
            state,
            'Kickoff',
            'Lower Round 2',
            ['Middle Round 1', 'Middle Round 2', 'Lower Round 1'],
            region,
          ),
        ).toHaveLength(0)
        expect(
          rematches(
            state,
            'Kickoff',
            'Lower Round 3',
            ['Middle Round 2', 'Middle Round 3', 'Lower Round 2'],
            region,
          ),
        ).toHaveLength(0)
      })
    }
  })
})
