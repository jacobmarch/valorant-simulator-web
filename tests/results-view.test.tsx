import { beforeEach, describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { advanceWeek, createGame, hasMatchDetail, pruneHistory, type GameState } from '../src/game'
import { BoxScoreModal } from '../src/game-views'
import { Results, eventRecords, seasonResults } from '../src/results-view'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

const playWeeks = (state: GameState, weeks: number) => {
  let next = state
  for (let i = 0; i < weeks; i++)
    next = advanceWeek(next, 'Measured defaults', 'Disciplined retakes')
  return next
}

describe('season results page', () => {
  test('lists every managed series this season, newest first, with its event', () => {
    const state = playWeeks(createGame('Manager', 'sen'), 12)
    const results = seasonResults(state, state.season)
    expect(results.length).toBeGreaterThan(0)
    for (const result of results) {
      expect([result.match.aId, result.match.bId]).toContain(state.currentTeamId)
      expect(result.match.season).toBe(state.season)
      expect(result.fixture?.id).toBe(result.match.fixtureId)
    }
    const weeks = results.map((result) => result.match.week)
    expect(weeks).toEqual([...weeks].sort((a, b) => b - a))
    const records = eventRecords(results)
    expect(records.reduce((sum, entry) => sum + entry.wins + entry.losses, 0)).toBe(results.length)
    const html = renderToStaticMarkup(<Results s={state} onOpenFull={() => {}} />)
    expect(html).toContain('Season results')
    expect(html).toContain(records[0].event)
  })
  test('keeps last season out of the current season view', () => {
    const state = playWeeks(createGame('Manager', 'sen'), 6)
    const played = seasonResults(state, state.season).length
    const moved = { ...state, season: state.season + 1 }
    expect(seasonResults(moved, moved.season)).toHaveLength(0)
    expect(seasonResults(moved, state.season)).toHaveLength(played)
  })
  test('box score pop-up explains when player stats were pruned', () => {
    const state = playWeeks(createGame('Manager', 'sen'), 6)
    const match = seasonResults(state, state.season)[0].match
    const full = renderToStaticMarkup(<BoxScoreModal s={state} match={match} onClose={() => {}} />)
    expect(full).toContain('Entire series')
    expect(full).toContain('ACS')
    const pruned = pruneHistory(
      { ...state, currentTeamId: 'none', matches: [...state.matches] },
      { detailedMatches: 0 },
    ).matches.find((candidate) => candidate.id === match.id)
    if (!pruned) throw new Error('match missing')
    expect(hasMatchDetail(pruned)).toBe(false)
    const html = renderToStaticMarkup(<BoxScoreModal s={state} match={pruned} onClose={() => {}} />)
    expect(html).toContain('cleared to keep the save small')
  })
})
