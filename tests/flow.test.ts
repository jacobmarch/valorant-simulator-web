import { beforeEach, describe, expect, test } from 'bun:test'
import { attentionItems, continueReport, nextAction } from '../src/flow'
import { createGame, simulateTournamentRound } from '../src/game'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

describe('game flow helpers', () => {
  test('Kickoff is played a round at a time', () => {
    const action = nextAction(createGame('Manager', 'envy'))
    expect(action.mode).toBe('round')
    expect(action.label.length).toBeGreaterThan(0)
  })

  test('a new save flags unplanned training', () => {
    const items = attentionItems(createGame('Manager', 'envy'))
    expect(items.find((item) => item.id === 'training')?.view).toBe('training')
  })

  test('continue report counts the series a step produced', () => {
    const before = createGame('Manager', 'envy')
    const after = simulateTournamentRound(before, 'Measured defaults', 'Disciplined retakes')
    const report = continueReport(before, after)
    expect(report.managed.length + report.others).toBe(after.matches.length - before.matches.length)
    expect(report.managed.length + report.others).toBeGreaterThan(0)
  })
})
