import { beforeEach, describe, expect, test } from 'bun:test'
import { advanceWeek, createGame, eventFinish, type GameState, loadGame } from '../src/game'
import { renderToStaticMarkup } from 'react-dom/server'
import { YearInReview } from '../src/season-review-view'
import type { Region } from '../src/seed'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

// Matches the private key in src/game.ts.
const SAVE_KEY = 'vct-manager-mvp-save-v1'
const regions: Region[] = ['Americas', 'EMEA', 'Pacific', 'China']
const step = (state: GameState) => advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
const advanceTo = (state: GameState, season: number, week: number) => {
  while (state.season < season || state.week < week) state = step(state)
  return state
}

describe('year in review', () => {
  test('rollover stores a review of the finished season and flags the pop-up', () => {
    let state = advanceTo(createGame('Manager', 'c9'), 2026, 52)
    const finish = (phase: 'Masters 1' | 'Champions' | 'Stage 2', region?: Region) =>
      eventFinish(state, phase, region)[0]
    const expected = {
      masters1: finish('Masters 1'),
      champions: finish('Champions'),
      stage2: Object.fromEntries(regions.map((region) => [region, finish('Stage 2', region)])),
      record: [state.teams.c9.wins, state.teams.c9.losses],
      lines: structuredClone(state.seasonStats ?? {}),
      // Rollover prunes other teams' 2026 series, so count the maps before it.
      playedMaps: state.matches
        .filter((match) => match.season === 2026)
        .reduce((sum, match) => sum + match.maps.length, 0),
    }
    state = step(state)
    expect(state.season).toBe(2027)
    expect(state.pendingReview).toBe(2026)
    expect(state.seasonStats).toEqual({})
    const review = state.reviews?.[0]
    if (!review) throw new Error('no review')
    expect(review.season).toBe(2026)
    expect(review.teamId).toBe('c9')
    expect([review.record.wins, review.record.losses]).toEqual(expected.record)
    expect(review.events.find((event) => event.phase === 'Masters 1')?.podium[0]).toBe(
      expected.masters1,
    )
    expect(review.events.find((event) => event.phase === 'Champions')?.podium[0]).toBe(
      expected.champions,
    )
    regions.forEach((region) => {
      const league = review.leagues.find((entry) => entry.region === region)
      expect(league?.stage2[0]).toBe(expected.stage2[region])
      expect(league?.champions).toHaveLength(4)
      expect(league?.mvp && state.teams[league.mvp.teamId].region).toBe(region)
    })
    // MVPs come from the whole season's tallies, not just the box scores that survived pruning.
    expect(review.teamMvp?.teamId).toBe('c9')
    expect(review.teamMvp && expected.lines[review.teamMvp.playerId].teamId).toBe('c9')
    expect(review.globalMvp).not.toBeNull()
    const totalMaps = Object.values(expected.lines).reduce((sum, line) => sum + line.maps, 0)
    expect(totalMaps).toBe(expected.playedMaps * 10)
    expect(review.placements.map((placement) => placement.phase)).toEqual([
      'Kickoff',
      'Masters 1',
      'Stage 1',
      'Masters 2',
      'Stage 2',
      'Champions',
    ])
    const html = renderToStaticMarkup(<YearInReview s={state} onClose={() => {}} />)
    expect(html).toContain(state.teams.c9.name)
    expect(html).toContain(review.teamMvp?.name ?? '')
    expect(html).toContain('On to 2027')
    // The review survives a save and reload, and a second season adds another.
    const loaded = loadGame()
    expect(loaded?.reviews?.[0].season).toBe(2026)
    loaded!.pendingReview = null
    state = advanceTo(loaded!, 2028, 1)
    expect(state.reviews?.map((entry) => entry.season)).toEqual([2027, 2026])
    expect(state.pendingReview).toBe(2027)
    // The 2027 review only counts 2027 fixtures.
    const champions2027 = state.reviews![0].events.find((event) => event.phase === 'Champions')
    expect(champions2027?.podium).toHaveLength(4)
  }, 600_000)

  test('v15 saves migrate with empty reviews and rebuilt season lines', () => {
    const state = advanceTo(createGame('Manager', 'c9'), 2026, 3)
    const legacy = structuredClone(state) as Partial<GameState>
    legacy.version = 15 as 16
    delete legacy.seasonStats
    delete legacy.reviews
    delete legacy.pendingReview
    memory.set(SAVE_KEY, JSON.stringify(legacy))
    const loaded = loadGame()
    expect(loaded?.version).toBe(17)
    expect(loaded?.reviews).toEqual([])
    expect(loaded?.pendingReview).toBeNull()
    expect(Object.keys(loaded?.seasonStats ?? {}).length).toBeGreaterThan(0)
  })
})
