import { beforeEach, describe, expect, test } from 'bun:test'
import { stepWeek } from './helpers'
import {
  CHAMPIONSHIP_POINTS,
  championshipPointsStandings,
  championshipPointsTable,
  championsQualifiers,
  createGame,
  type Fixture,
  type GameState,
  loadGame,
  SAVE_KEY,
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
beforeEach(() => memory.clear())

const regions: Region[] = ['Americas', 'EMEA', 'Pacific', 'China']
const step = (state: GameState) => stepWeek(state)
const advanceTo = (state: GameState, season: number, week: number) => {
  while (state.season < season || state.week < week) state = step(state)
  return state
}
const loser = (fixture: Fixture) => (fixture.winnerId === fixture.aId ? fixture.bId : fixture.aId)
const find = (state: GameState, phase: string, label: string, region?: Region) =>
  state.fixtures.find(
    (fixture) =>
      fixture.season === state.season &&
      fixture.phase === phase &&
      fixture.label === label &&
      (!region || fixture.region === region),
  )!

// Recounts one season's points straight from the results, independent of the game code.
function expectPointsMatchResults(state: GameState) {
  const season = state.fixtures.filter((fixture) => fixture.season === state.season)
  const expected: Record<string, number> = Object.fromEntries(
    Object.keys(state.teams).map((id) => [id, 0]),
  )
  season
    .filter(
      (fixture) =>
        (fixture.phase === 'Stage 1' || fixture.phase === 'Stage 2') &&
        fixture.stage === 'League' &&
        fixture.status === 'completed',
    )
    .forEach((fixture) => expected[fixture.winnerId!]++)
  regions.forEach((region) => {
    const upper = find(state, 'Kickoff', 'Upper Final', region),
      middle = find(state, 'Kickoff', 'Middle Final', region),
      lower = find(state, 'Kickoff', 'Lower Final', region)
    ;[upper.winnerId!, middle.winnerId!, lower.winnerId!, loser(lower)!].forEach(
      (id, index) => (expected[id] += CHAMPIONSHIP_POINTS.Kickoff[index]),
    )
  })
  const bracketOrder = (phase: string, region?: Region) => {
    const playoffs = season.filter(
      (fixture) =>
        fixture.phase === phase &&
        fixture.stage === 'Playoffs' &&
        (!region || fixture.region === region),
    )
    const losers = (label: string) =>
      playoffs.filter((fixture) => fixture.label === label).map((fixture) => loser(fixture)!)
    const grandFinal = playoffs.find((fixture) => fixture.label === 'Grand Final')!
    return [
      grandFinal.winnerId!,
      loser(grandFinal)!,
      ...losers('Lower Final'),
      ...losers('Lower Round 3'),
      ...losers('Lower Round 2'),
      ...losers('Lower Round 1'),
    ]
  }
  ;(['Masters 1', 'Masters 2'] as const).forEach((phase) =>
    bracketOrder(phase).forEach(
      (id, index) => (expected[id] += CHAMPIONSHIP_POINTS[phase][index] ?? 0),
    ),
  )
  ;(['Stage 1', 'Stage 2'] as const).forEach((phase) =>
    regions.forEach((region) =>
      bracketOrder(phase, region).forEach(
        (id, index) => (expected[id] += CHAMPIONSHIP_POINTS[phase][index] ?? 0),
      ),
    ),
  )
  const table = championshipPointsTable(state)
  Object.values(state.teams).forEach((team) => {
    expect(team.championshipPoints).toBe(expected[team.id])
    expect(table[team.id].total).toBe(expected[team.id])
  })
}

// Seeds 1-2 are the Stage 2 finalists; seeds 3-4 are the best two others by points.
function expectChampionsField(state: GameState) {
  const field = new Set<string>()
  regions.forEach((region) => {
    const qualifiers = championsQualifiers(state, region)
    const grandFinal = find(state, 'Stage 2', 'Grand Final', region)
    expect(qualifiers.slice(0, 2)).toEqual([grandFinal.winnerId!, loser(grandFinal)!])
    const others = championshipPointsStandings(state, region).filter(
      (id) => !qualifiers.slice(0, 2).includes(id),
    )
    expect(qualifiers.slice(2)).toEqual(others.slice(0, 2))
    const cutoff = state.teams[others[1]].championshipPoints
    others
      .slice(2)
      .forEach((id) => expect(state.teams[id].championshipPoints).toBeLessThanOrEqual(cutoff))
    qualifiers.forEach((id, index) => {
      expect(state.teams[id].playoffStage).toBe(`Champions qualifier #${index + 1}`)
      field.add(id)
    })
  })
  const openers = state.fixtures.filter(
    (fixture) =>
      fixture.season === state.season &&
      fixture.phase === 'Champions' &&
      fixture.label.endsWith('Opening'),
  )
  expect(new Set(openers.flatMap((fixture) => [fixture.aId, fixture.bId!]))).toEqual(field)
}

describe('Championship Points', () => {
  test('Kickoff awards 4, 3, 2 and 1 points to its top four', () => {
    const state = advanceTo(createGame('Points', 'sen'), 2026, 7)
    regions.forEach((region) => {
      const lower = find(state, 'Kickoff', 'Lower Final', region)
      const top = [
        find(state, 'Kickoff', 'Upper Final', region).winnerId!,
        find(state, 'Kickoff', 'Middle Final', region).winnerId!,
        lower.winnerId!,
        loser(lower)!,
      ]
      expect(top.map((id) => state.teams[id].championshipPoints)).toEqual([4, 3, 2, 1])
      Object.values(state.teams)
        .filter((team) => team.region === region && !top.includes(team.id))
        .forEach((team) => expect(team.championshipPoints).toBe(0))
    })
  })

  test('points follow placements and Stage wins, and pick Champions seeds 3 and 4 over two seasons', {
    timeout: 60000,
  }, () => {
    let state = advanceTo(createGame('Points', 'sen'), 2026, 37)
    expectPointsMatchResults(state)
    expectChampionsField(state)

    // Champions itself earns no points.
    const before = Object.fromEntries(
      Object.values(state.teams).map((team) => [team.id, team.championshipPoints]),
    )
    state = advanceTo(state, 2026, 43)
    Object.values(state.teams).forEach((team) =>
      expect(team.championshipPoints).toBe(before[team.id]),
    )

    // The next season starts from zero and counts only its own results.
    state = advanceTo(state, 2027, 1)
    Object.values(state.teams).forEach((team) => expect(team.championshipPoints).toBe(0))
    state = advanceTo(state, 2027, 37)
    expectPointsMatchResults(state)
    expectChampionsField(state)
  })

  test('a version 13 save rebuilds points from its results', () => {
    const state = advanceTo(createGame('Points', 'sen'), 2026, 13)
    const legacy = structuredClone(state) as GameState & { version: number }
    legacy.version = 13
    Object.values(legacy.teams).forEach((team) => {
      team.championshipPoints += 9
    })
    localStorage.setItem(SAVE_KEY, JSON.stringify(legacy))
    const loaded = loadGame()!
    expect(loaded.version).toBe(16)
    Object.values(loaded.teams).forEach((team) =>
      expect(team.championshipPoints).toBe(state.teams[team.id].championshipPoints),
    )
  })
})
