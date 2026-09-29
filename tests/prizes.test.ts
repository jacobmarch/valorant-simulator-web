import { beforeEach, describe, expect, test } from 'bun:test'
import { advanceWeek, createGame, type Fixture, type GameState } from '../src/game'
import { PRIZES, payEventPrizes, seasonPrizes } from '../src/prizes'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

const playoff = (state: GameState, label: string, winnerId: string, loserId: string) => {
  const fixture: Fixture = {
    id: `test-${label}`,
    season: state.season,
    week: 10,
    phase: 'Masters 1',
    scope: 'international',
    round: 1,
    label,
    aId: winnerId,
    bId: loserId,
    bestOf: 5,
    status: 'completed',
    winnerId,
    stage: 'Playoffs',
  }
  state.fixtures.push(fixture)
  return fixture
}

describe('prize money', () => {
  test('an event pays its top finishers once, when the final is played', () => {
    const state = createGame('Manager', 'c9')
    state.fixtures = state.fixtures.filter((fixture) => fixture.phase !== 'Masters 1')
    playoff(state, 'Lower Round 3', 'fnc', 'prx')
    playoff(state, 'Lower Final', 'fnc', 'gen')
    const cash = () => ['c9', 'fnc', 'gen', 'prx'].map((id) => state.teams[id].cash)
    const before = cash()
    payEventPrizes(state)
    expect(cash()).toEqual(before)
    const final = playoff(state, 'Grand Final', 'c9', 'fnc')
    payEventPrizes(state)
    payEventPrizes(state)
    expect(final.prizePaid).toBeTrue()
    const [, , geng] = cash()
    expect(cash()[0] - before[0]).toBe(PRIZES['Masters 1'][0])
    expect(cash()[1] - before[1]).toBe(PRIZES['Masters 1'][1])
    if (state.teams.geng) expect(geng - before[2]).toBe(PRIZES['Masters 1'][2])
    expect(seasonPrizes(state, 'c9')).toEqual([
      { phase: 'Masters 1', place: '1st', amount: PRIZES['Masters 1'][0] },
    ])
    expect(state.inbox.some((line) => line.startsWith('Prize money: Cloud9 earned'))).toBeTrue()
  })

  test('the Kickoff pays out during a normal season', { timeout: 15000 }, () => {
    let state = createGame('Manager', 'c9')
    while (state.week <= 7) state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const paid = Object.keys(state.teams).flatMap((id) => seasonPrizes(state, id))
    // Four regions, four paid places each.
    expect(paid.filter((prize) => prize.phase === 'Kickoff')).toHaveLength(16)
  })
})
