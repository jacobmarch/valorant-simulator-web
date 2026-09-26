import { beforeEach, describe, expect, test } from 'bun:test'
import {
  advanceWeek,
  createGame,
  type GameState,
  hasMatchDetail,
  loadGame,
  pruneHistory,
  SAVE_KEY,
  saveGame,
} from '../src/game'

const memory = new Map<string, string>()
let quota = Number.POSITIVE_INFINITY
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => {
      if (value.length > quota) throw new DOMException('Quota exceeded', 'QuotaExceededError')
      memory.set(key, value)
    },
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => {
  memory.clear()
  quota = Number.POSITIVE_INFINITY
})

const playWeeks = (state: GameState, weeks: number) => {
  let next = state
  for (let index = 0; index < weeks; index++) next = advanceWeek(next, 'Default', 'Default')
  return next
}
const involvesManaged = (state: GameState) => (match: GameState['matches'][number]) =>
  match.aId === state.currentTeamId || match.bId === state.currentTeamId

describe('save size', () => {
  test('a season and a half stays well under the browser storage quota', () => {
    const state = playWeeks(createGame('Manager', 'c9'), 80)
    const saved = memory.get(SAVE_KEY) ?? ''
    expect(state.season).toBe(2027)
    expect(saved.length).toBeLessThan(2_500_000)
    const parsed = JSON.parse(saved) as GameState
    expect(parsed.matches.every((match) => match.season >= 2026)).toBe(true)
    expect(
      parsed.matches
        .filter((m) => m.season === 2027)
        .filter(involvesManaged(parsed))
        .every(hasMatchDetail),
    ).toBe(true)
    expect(hasMatchDetail(parsed.matches[0])).toBe(true)
  }, 120_000)

  test('seasons older than the previous one are dropped', () => {
    const state = createGame('Manager', 'c9')
    const match = playWeeks(state, 1).matches[0]
    state.season = 2028
    state.matches = [
      { ...match, season: 2026 },
      { ...match, season: 2027 },
    ]
    pruneHistory(state)
    expect(state.matches.map((m) => m.season)).toEqual([2027])
  })

  test('saving never throws when storage is full', () => {
    const state = playWeeks(createGame('Manager', 'c9'), 12)
    quota = 50_000
    expect(saveGame(state)).toBe(false)
    const full = JSON.stringify(state).length
    quota = full - 1
    expect(saveGame(state)).toBe(true)
    expect(loadGame()?.week).toBe(state.week)
  }, 60_000)

  test('an existing oversized save is trimmed when it loads', () => {
    const state = playWeeks(createGame('Manager', 'c9'), 12)
    const bloated = {
      ...state,
      matches: [...state.matches, ...state.matches.map((m) => ({ ...m, id: `${m.id}-copy` }))],
    }
    memory.set(SAVE_KEY, JSON.stringify(bloated))
    const loaded = loadGame()
    expect(loaded).not.toBeNull()
    expect(loaded!.matches.length).toBe(bloated.matches.length)
    expect(loaded!.matches.filter(hasMatchDetail).length).toBeLessThan(bloated.matches.length)
    expect(JSON.stringify(loaded).length).toBeLessThan(JSON.stringify(bloated).length)
  }, 60_000)
})
