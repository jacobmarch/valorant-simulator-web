import { beforeEach, describe, expect, test } from 'bun:test'
import { createGame, type GameState, rolloverSeason } from '../src/game'
import {
  careerAcs,
  clubStints,
  contractHistory,
  honours,
  ratingsRevealed,
  SCOUT_REVEAL,
} from '../src/player-card'
import type { PlayerSeasonRecord } from '../src/season-review'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

const record = (
  season: number,
  teamId: string | null,
  overrides: Partial<PlayerSeasonRecord> = {},
): PlayerSeasonRecord => ({
  season,
  teamId,
  salary: 100_000,
  years: 2,
  overall: 70,
  potential: 80,
  maps: 0,
  acs: null,
  kd: null,
  titles: [],
  awards: [],
  ...overrides,
})

describe('player card history', () => {
  test('rollover writes a career entry for every rostered player', () => {
    const state = createGame('Manager', 'c9')
    const player = Object.values(state.players).find((p) => p.teamId)
    if (!player) throw new Error('no rostered player')
    const teamId = player.teamId
    const salary = player.salary
    rolloverSeason(state)
    const entry = state.players[player.id].career?.at(-1)
    expect(entry?.season).toBe(2026)
    expect(entry?.teamId).toBe(teamId)
    expect(entry?.salary).toBe(salary)
    expect(entry?.overall).toBeGreaterThan(0)
  })

  test('free agents without a club or a played season get no entry', () => {
    const state = createGame('Manager', 'c9')
    const free = Object.values(state.players).find((p) => !p.teamId)
    if (!free) return
    rolloverSeason(state)
    expect(state.players[free.id].career ?? []).toHaveLength(0)
  })

  test('the career log keeps the newest ten seasons', () => {
    const state = createGame('Manager', 'c9')
    const player = Object.values(state.players).find((p) => p.teamId)
    if (!player) throw new Error('no rostered player')
    for (let index = 0; index < 12; index++) rolloverSeason(state)
    expect(state.players[player.id].career?.length ?? 0).toBeLessThanOrEqual(10)
  })

  test('consecutive seasons at one club merge into one stint', () => {
    const state = { season: 2028, teamId: 'x' } as unknown as GameState
    const player = {
      teamId: 'b',
      career: [record(2025, 'a'), record(2026, 'b'), record(2027, 'b')],
    } as never
    const stints = clubStints({ ...state, season: 2028 } as GameState, player)
    expect(stints).toEqual([
      { teamId: 'a', from: 2025, to: 2025 },
      { teamId: 'b', from: 2026, to: 2028 },
    ])
  })

  test('a return to an earlier club starts a new stint', () => {
    const state = { season: 2028 } as GameState
    const player = {
      teamId: null,
      career: [record(2025, 'a'), record(2026, 'b'), record(2027, 'a')],
    } as never
    expect(clubStints(state, player).map((stint) => stint.teamId)).toEqual(['a', 'b', 'a'])
  })

  test('contracts group seasons at the same club and salary, and flag the current one', () => {
    const state = { season: 2028 } as GameState
    const player = {
      teamId: 'b',
      salary: 150_000,
      years: 1,
      career: [
        record(2025, 'a', { salary: 100_000 }),
        record(2026, 'a', { salary: 100_000 }),
        record(2027, 'b', { salary: 150_000 }),
      ],
    } as never
    const terms = contractHistory(state, player)
    expect(terms.map((term) => [term.teamId, term.from, term.to, term.current])).toEqual([
      ['a', 2025, 2026, false],
      ['b', 2027, 2028, true],
    ])
  })

  test('honours list titles and awards newest first', () => {
    const player = {
      career: [
        record(2025, 'a', { titles: ['Masters 1'] }),
        record(2026, 'a', { awards: ['Team MVP'], titles: ['Champions'] }),
      ],
    } as never
    expect(honours(player)).toEqual([
      { season: 2026, kind: 'title', label: 'Champions' },
      { season: 2026, kind: 'award', label: 'Team MVP' },
      { season: 2025, kind: 'title', label: 'Masters 1' },
    ])
  })

  test('career ACS weights each season by its maps', () => {
    const player = {
      career: [
        record(2025, 'a', { maps: 10, acs: 200 }),
        record(2026, 'a', { maps: 30, acs: 280 }),
      ],
    } as never
    expect(careerAcs(player)).toBe(260)
    expect(careerAcs({ career: [] } as never)).toBeNull()
  })
})

describe('player card visibility', () => {
  test('own players are always readable; rivals need scouting', () => {
    const state = createGame('Manager', 'c9')
    const own = Object.values(state.players).find((p) => p.teamId === state.currentTeamId)
    const rival = Object.values(state.players).find(
      (p) => p.teamId && p.teamId !== state.currentTeamId,
    )
    if (!own || !rival) throw new Error('missing players')
    expect(ratingsRevealed(state, own)).toBe(true)
    rival.scoutProgress = SCOUT_REVEAL - 1
    expect(ratingsRevealed(state, rival)).toBe(false)
    rival.scoutProgress = SCOUT_REVEAL
    expect(ratingsRevealed(state, rival)).toBe(true)
  })
})
