import { beforeEach, describe, expect, test } from 'bun:test'
import {
  acceptFiredPosition,
  advanceWeek,
  createGame,
  type GameState,
  simulateTournamentRound,
  teamStrength,
} from '../src/game'
import { DEBT_LIMIT, FIRED_TEAM_OPTIONS } from '../src/debt'
import { fillRoster } from './helpers'
import { freeAgents, signFreeAgent, signFreeAgentError } from '../src/transfers'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

const cheapestAgent = (state: GameState) => freeAgents(state).sort((a, b) => a.salary - b.salary)[0]

/** A managed game in preseason with a legal roster, ready to be pushed into debt. */
function rosterGame(teamId = 'c9'): GameState {
  return fillRoster(createGame('Manager', teamId))
}

describe('debt allowance for the managed club', () => {
  test('a broke club under the roster limit can still sign a player by borrowing', () => {
    const state = rosterGame()
    state.teams.c9.cash = 0
    const agent = cheapestAgent(state)
    const outcome = signFreeAgent(state, 'c9', agent.id)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.state.teams.c9.cash).toBeLessThan(0)
  })

  test('signings are refused once they would breach the debt limit', () => {
    const state = rosterGame()
    state.teams.c9.cash = -DEBT_LIMIT
    const error = signFreeAgentError(state, 'c9', cheapestAgent(state).id)
    expect(error).toContain('debt limit')
  })

  test('other organizations still need the cash on hand', () => {
    const state = rosterGame()
    state.teams.sen.cash = 0
    const agent = cheapestAgent(state)
    expect(signFreeAgentError(state, 'sen', agent.id)).toContain('not enough')
  })
})

describe('firing', () => {
  test('a club inside the debt limit is not fired', () => {
    const state = rosterGame()
    state.teams.c9.cash = -DEBT_LIMIT + 1_000_000
    const next = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    expect(next.fired).toBeFalsy()
  })

  test('running past the limit fires the manager and offers the weakest clubs', () => {
    const state = rosterGame()
    state.teams.c9.cash = -DEBT_LIMIT - 1
    const next = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    expect(next.fired).toBeTruthy()
    expect(next.fired?.teamId).toBe('c9')
    expect(next.fired?.season).toBe(state.season)
    expect(next.fired?.options).toHaveLength(FIRED_TEAM_OPTIONS)
    expect(next.fired?.options).not.toContain('c9')

    const expected = Object.keys(next.teams)
      .filter((id) => id !== 'c9')
      .sort((a, b) => teamStrength(next, a) - teamStrength(next, b) || a.localeCompare(b))
      .slice(0, FIRED_TEAM_OPTIONS)
    expect(next.fired?.options).toEqual(expected)
    expect(next.teams.c9.cash).toBe(0)
  })

  test('a fired save cannot advance until a new club is taken', () => {
    const state = rosterGame()
    state.teams.c9.cash = -DEBT_LIMIT - 1
    const fired = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    expect(advanceWeek(fired, 'Measured defaults', 'Disciplined retakes')).toBe(fired)
    expect(simulateTournamentRound(fired, 'Measured defaults', 'Disciplined retakes')).toBe(fired)
  })

  test('taking an offered club keeps the save and hands over the team', () => {
    const state = rosterGame()
    state.teams.c9.cash = -DEBT_LIMIT - 1
    const fired = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const target = fired.fired?.options[0] as string
    const next = acceptFiredPosition(fired, target)
    expect(next.currentTeamId).toBe(target)
    expect(next.fired).toBeNull()
    expect(next.week).toBe(fired.week)
    expect(next.season).toBe(fired.season)
    expect(next.matches).toEqual(fired.matches)
    expect(next.fixtures).toEqual(fired.fixtures)
    expect(next.teams.c9.playerIds.length).toBeGreaterThanOrEqual(5)
  })

  test('a club outside the offer list cannot be taken', () => {
    const state = rosterGame()
    state.teams.c9.cash = -DEBT_LIMIT - 1
    const fired = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const outside = Object.keys(fired.teams).find(
      (id) => id !== 'c9' && !fired.fired?.options.includes(id),
    ) as string
    expect(acceptFiredPosition(fired, outside)).toBe(fired)
  })
})
