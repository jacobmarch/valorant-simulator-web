import { beforeEach, describe, expect, test } from 'bun:test'
import {
  advanceWeek,
  createGame,
  currentTournamentDeskFixtures,
  fixturesForWeek,
  loadGame,
  nextFixtureForTeam,
  playableTournamentFixtureIds,
  SAVE_KEY,
  simulateNextTournamentMatch,
  simulateSeries,
  simulateTournamentFixture,
  simulateTournamentRound,
} from '../src/game'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

describe('competition fixtures', () => {
  test('the dashboard source has a real week-one opponent', () => {
    const state = createGame('Manager', 'c9')
    const fixture = nextFixtureForTeam(state, 'c9', 1)
    expect(fixture).toBeDefined()
    const opponentId = fixture!.aId === 'c9' ? fixture!.bId : fixture!.aId
    expect(opponentId).toBeTruthy()
    expect(opponentId).not.toBe('c9')
  })
  test('existing browser saves migrate and receive a current fixture', () => {
    const legacy = createGame('Manager', 'c9') as any
    delete legacy.fixtures
    delete legacy.kickoff
    legacy.version = 1
    localStorage.setItem(SAVE_KEY, JSON.stringify(legacy))
    const migrated = loadGame()!
    expect(migrated.version).toBe(12)
    expect(nextFixtureForTeam(migrated, 'c9', migrated.week)).toBeDefined()
  })
  test('an in-progress legacy international save restarts on the corrected bracket', () => {
    let legacy = createGame('Manager', 'c9') as any
    for (let week = 0; week < 7; week++)
      legacy = advanceWeek(legacy, 'Measured defaults', 'Disciplined retakes')
    legacy.version = 2
    legacy.fixtures
      .filter((fixture: any) => fixture.phase === 'Masters 1')
      .forEach((fixture: any) => {
        delete fixture.stage
        delete fixture.bracket
      })
    localStorage.setItem(SAVE_KEY, JSON.stringify(legacy))
    const migrated = loadGame()!
    expect(migrated.version).toBe(12)
    expect(migrated.week).toBe(8)
    expect(migrated.fixtures.filter((fixture) => fixture.phase === 'Masters 1')).toHaveLength(4)
    expect(
      migrated.fixtures
        .filter((fixture) => fixture.phase === 'Masters 1')
        .every((fixture) => fixture.stage === 'Swiss'),
    ).toBeTrue()
  })

  test('a version 7 Kickoff save restarts with the no-bye feeder graph', () => {
    let legacy = createGame('Manager', 'c9') as any
    legacy = advanceWeek(legacy, 'Measured defaults', 'Disciplined retakes')
    legacy = advanceWeek(legacy, 'Measured defaults', 'Disciplined retakes')
    legacy.version = 7
    localStorage.setItem(SAVE_KEY, JSON.stringify(legacy))

    const migrated = loadGame()!
    const kickoff = migrated.fixtures.filter((fixture) => fixture.phase === 'Kickoff')
    expect(migrated.version).toBe(12)
    expect(migrated.week).toBe(1)
    expect(kickoff).toHaveLength(16)
    expect(kickoff.every((fixture) => fixture.label === 'Upper Round 1' && fixture.bId)).toBeTrue()
    expect(migrated.matches.some((match) => match.phase === 'Kickoff')).toBeFalse()
    expect(migrated.inbox[0]).toContain('no-bye middle and lower bracket')
  })

  test('match-by-match tournament simulation resolves one fixture without advancing the round', () => {
    const state = createGame('Manager', 'c9')
    const scheduledBefore = fixturesForWeek(state, 1).filter(
      (fixture) => fixture.status === 'scheduled',
    ).length
    const next = simulateNextTournamentMatch(
      state,
      'Measured defaults',
      'Disciplined retakes',
      'Kickoff',
      'EMEA',
    )
    expect(next.week).toBe(1)
    expect(next.matches).toHaveLength(1)
    expect(next.teams[next.matches[0].aId].region).toBe('EMEA')
    expect(
      fixturesForWeek(next, 1).filter((fixture) => fixture.status === 'scheduled'),
    ).toHaveLength(scheduledBefore - 1)
  })

  test('Kickoff closing paths advance one bracket round at a time', { timeout: 10000 }, () => {
    let state = createGame('Manager', 'c9')
    for (let week = 0; week < 5; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    state = simulateTournamentRound(state, 'Measured defaults', 'Disciplined retakes')
    expect(state.week).toBe(6)
    expect(
      fixturesForWeek(state, 6).some(
        (fixture) => fixture.label === 'Lower Round 4' && fixture.status === 'scheduled',
      ),
    ).toBeTrue()
    state = simulateTournamentRound(state, 'Measured defaults', 'Disciplined retakes')
    expect(state.week).toBe(6)
    expect(
      fixturesForWeek(state, 6).filter(
        (fixture) => fixture.label === 'Middle Final' && fixture.status === 'scheduled',
      ),
    ).toHaveLength(4)
    expect(
      fixturesForWeek(state, 6).filter(
        (fixture) => fixture.label === 'Lower Round 5' && fixture.status === 'scheduled',
      ),
    ).toHaveLength(4)
    state = simulateTournamentRound(state, 'Measured defaults', 'Disciplined retakes')
    expect(state.week).toBe(6)
    expect(
      fixturesForWeek(state, 6).filter(
        (fixture) => fixture.label === 'Lower Final' && fixture.status === 'scheduled',
      ),
    ).toHaveLength(4)
    state = simulateTournamentRound(state, 'Measured defaults', 'Disciplined retakes')
    expect(state.week).toBe(6)
    expect(
      fixturesForWeek(state, 6).filter(
        (fixture) => fixture.label === 'Lower Final' && fixture.status === 'completed',
      ),
    ).toHaveLength(4)
    state = simulateTournamentRound(state, 'Measured defaults', 'Disciplined retakes')
    expect(state.week).toBe(7)
  })

  test('Masters 1 playoffs advance one bracket round at a time', { timeout: 15000 }, () => {
    let state = createGame('Manager', 'c9')
    for (let week = 0; week < 9; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    expect(state.week).toBe(10)
    const playoff = () =>
      state.fixtures.filter(
        (fixture) => fixture.phase === 'Masters 1' && fixture.stage === 'Playoffs',
      )
    const completed = (label: string) =>
      playoff().filter((fixture) => fixture.label === label && fixture.status === 'completed')
    const scheduled = (label: string) =>
      playoff().filter((fixture) => fixture.label === label && fixture.status === 'scheduled')
    const step = (attack: string) => {
      const before = playoff()
        .filter((fixture) => fixture.status === 'completed')
        .map((fixture) => fixture.label)
      state = simulateTournamentRound(state, 'Measured defaults', 'Disciplined retakes')
      const after = playoff()
        .filter((fixture) => fixture.status === 'completed')
        .map((fixture) => fixture.label)
      const newly = after.filter((_, index) => index >= before.length)
      expect(state.week).toBe(10)
      expect(newly.every((label) => attack.split('|').includes(label))).toBeTrue()
      expect(newly.length).toBeGreaterThan(0)
    }
    expect(
      fixturesForWeek(state, 10).every(
        (fixture) => fixture.label === 'Upper Quarterfinal' && fixture.status === 'scheduled',
      ),
    ).toBeTrue()
    step('Upper Quarterfinal')
    expect(scheduled('Upper Semifinal')).toHaveLength(2)
    expect(scheduled('Lower Round 1')).toHaveLength(2)
    expect(playoff().some((fixture) => fixture.label === 'Grand Final')).toBeFalse()
    step('Upper Semifinal|Lower Round 1')
    expect(scheduled('Upper Final')).toHaveLength(1)
    expect(scheduled('Lower Round 2')).toHaveLength(2)
    expect(playoff().some((fixture) => fixture.label === 'Lower Round 3')).toBeFalse()
    step('Upper Final|Lower Round 2')
    expect(scheduled('Lower Round 3')).toHaveLength(1)
    expect(playoff().some((fixture) => fixture.label === 'Lower Final')).toBeFalse()
    step('Lower Round 3')
    expect(scheduled('Lower Final')).toHaveLength(1)
    expect(playoff().some((fixture) => fixture.label === 'Grand Final')).toBeFalse()
    step('Lower Final')
    expect(scheduled('Grand Final')).toHaveLength(1)
    step('Grand Final')
    expect(completed('Grand Final')).toHaveLength(1)
    expect(state.week).toBe(10)
    state = simulateTournamentRound(state, 'Measured defaults', 'Disciplined retakes')
    expect(state.week).toBe(11)
  })

  test('Play next match opens the next Masters 1 playoff round', { timeout: 15000 }, () => {
    let state = createGame('Manager', 'c9')
    for (let week = 0; week < 9; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const quarters = fixturesForWeek(state, 10).filter(
      (fixture) => fixture.label === 'Upper Quarterfinal' && fixture.status === 'scheduled',
    )
    expect(quarters).toHaveLength(4)
    for (let index = 0; index < 4; index++)
      state = simulateNextTournamentMatch(
        state,
        'Measured defaults',
        'Disciplined retakes',
        'Masters 1',
      )
    expect(
      fixturesForWeek(state, 10).filter(
        (fixture) => fixture.label === 'Upper Quarterfinal' && fixture.status === 'completed',
      ),
    ).toHaveLength(4)
    expect(
      fixturesForWeek(state, 10).filter(
        (fixture) =>
          (fixture.label === 'Upper Semifinal' || fixture.label === 'Lower Round 1') &&
          fixture.status === 'scheduled',
      ).length,
    ).toBeGreaterThan(0)
    let stuck = structuredClone(state)
    stuck.fixtures = stuck.fixtures.filter(
      (fixture) => fixture.label !== 'Upper Semifinal' && fixture.label !== 'Lower Round 1',
    )
    stuck = simulateNextTournamentMatch(
      stuck,
      'Measured defaults',
      'Disciplined retakes',
      'Masters 1',
    )
    expect(stuck.week).toBe(10)
    expect(
      fixturesForWeek(stuck, 10).some(
        (fixture) =>
          (fixture.label === 'Upper Semifinal' || fixture.label === 'Lower Round 1') &&
          fixture.status === 'completed',
      ),
    ).toBeTrue()
    const completedBefore = fixturesForWeek(state, 10).filter(
      (fixture) =>
        (fixture.label === 'Upper Semifinal' || fixture.label === 'Lower Round 1') &&
        fixture.status === 'completed',
    ).length
    state = simulateNextTournamentMatch(
      state,
      'Measured defaults',
      'Disciplined retakes',
      'Masters 1',
    )
    expect(state.week).toBe(10)
    expect(
      fixturesForWeek(state, 10).filter(
        (fixture) =>
          (fixture.label === 'Upper Semifinal' || fixture.label === 'Lower Round 1') &&
          fixture.status === 'completed',
      ).length,
    ).toBe(completedBefore + 1)
  })

  test('Masters 1 match desk keeps completed series until the round is finished', {
    timeout: 15000,
  }, () => {
    let state = createGame('Manager', 'c9')
    for (let week = 0; week < 9; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    expect(
      currentTournamentDeskFixtures(state, 'Masters 1').every(
        (fixture) => fixture.label === 'Upper Quarterfinal' && fixture.status === 'scheduled',
      ),
    ).toBeTrue()
    state = simulateNextTournamentMatch(
      state,
      'Measured defaults',
      'Disciplined retakes',
      'Masters 1',
    )
    const afterOne = currentTournamentDeskFixtures(state, 'Masters 1')
    expect(afterOne).toHaveLength(4)
    expect(afterOne.filter((fixture) => fixture.status === 'completed')).toHaveLength(1)
    expect(afterOne.filter((fixture) => fixture.status === 'scheduled')).toHaveLength(3)
    expect(afterOne.every((fixture) => fixture.label === 'Upper Quarterfinal')).toBeTrue()
    for (let index = 0; index < 3; index++)
      state = simulateNextTournamentMatch(
        state,
        'Measured defaults',
        'Disciplined retakes',
        'Masters 1',
      )
    const nextRound = currentTournamentDeskFixtures(state, 'Masters 1')
    expect(nextRound.every((fixture) => fixture.label === 'Upper Quarterfinal')).toBeFalse()
    expect(
      nextRound.every(
        (fixture) => fixture.label === 'Upper Semifinal' || fixture.label === 'Lower Round 1',
      ),
    ).toBeTrue()
    expect(nextRound.every((fixture) => fixture.status === 'scheduled')).toBeTrue()
  })

  test('Sim match plays one series and rounds auto-advance through the event', {
    timeout: 30000,
  }, () => {
    let state = createGame('Manager', 'c9')
    for (let week = 0; week < 9; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const firstRound = playableTournamentFixtureIds(state)
    expect(firstRound).toHaveLength(4)
    state = simulateTournamentFixture(
      state,
      firstRound[0],
      'Measured defaults',
      'Disciplined retakes',
    )
    expect(playableTournamentFixtureIds(state)).toEqual(firstRound.slice(1))
    const mastersEnd = state.week
    for (let guard = 0; guard < 200 && state.week <= mastersEnd; guard++) {
      const [next] = playableTournamentFixtureIds(state)
      expect(next).toBeDefined()
      state = simulateTournamentFixture(state, next, 'Measured defaults', 'Disciplined retakes')
    }
    expect(state.week).toBe(mastersEnd + 1)
    expect(
      state.fixtures.some(
        (fixture) =>
          fixture.phase === 'Masters 1' &&
          fixture.label === 'Grand Final' &&
          fixture.status === 'completed',
      ),
    ).toBeTrue()
  })

  test('Stage 1 playoffs do not dump the remaining bracket on Advance round', {
    timeout: 15000,
  }, () => {
    let state = createGame('Manager', 'c9')
    for (let week = 0; week < 16; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    expect(state.week).toBe(17)
    state = simulateTournamentRound(state, 'Measured defaults', 'Disciplined retakes')
    expect(state.week).toBe(17)
    const americas = state.fixtures.filter(
      (fixture) =>
        fixture.phase === 'Stage 1' && fixture.region === 'Americas' && fixture.week === 17,
    )
    expect(
      americas.filter(
        (fixture) => fixture.label === 'Upper Final' && fixture.status === 'scheduled',
      ),
    ).toHaveLength(1)
    expect(americas.some((fixture) => fixture.label === 'Lower Round 3')).toBeFalse()
    expect(americas.some((fixture) => fixture.label === 'Grand Final')).toBeFalse()
  })

  test('league weeks still resolve the full matchday when advancing the week', () => {
    let state = createGame('Manager', 'c9')
    for (let week = 0; week < 11; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    expect(state.week).toBe(12)
    const before = fixturesForWeek(state, 12).filter((fixture) => fixture.stage === 'League')
    expect(before.length).toBeGreaterThan(0)
    expect(before.every((fixture) => fixture.status === 'scheduled')).toBeTrue()
    state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    expect(state.week).toBe(13)
    expect(
      state.fixtures
        .filter((fixture) => fixture.week === 12 && fixture.stage === 'League')
        .every((fixture) => fixture.status === 'completed'),
    ).toBeTrue()
  })

  test('the scheduled opponent is the opponent that gets simulated', () => {
    const state = createGame('Manager', 'c9')
    const fixture = nextFixtureForTeam(state, 'c9', 1)!
    const opponentId = fixture.aId === 'c9' ? fixture.bId : fixture.aId
    const advanced = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const result = advanced.matches.find((match) => match.fixtureId === fixture.id)!
    expect([result.aId, result.bId]).toContain('c9')
    expect([result.aId, result.bId]).toContain(opponentId!)
  })

  test('Kickoff eliminates on three losses and sends three teams per region', () => {
    let state = createGame('Manager', 'c9')
    for (let week = 0; week < 6; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    for (const region of ['Americas', 'EMEA', 'Pacific', 'China'] as const) {
      const ids = Object.values(state.teams)
        .filter((team) => team.region === region)
        .map((team) => team.id)
      expect(ids.filter((id) => state.kickoff[id].status === 'qualified')).toHaveLength(3)
      expect(
        ids.filter(
          (id) => state.kickoff[id].status === 'eliminated' && state.kickoff[id].losses < 3,
        ),
      ).toHaveLength(0)
    }
  })
  test('international fixtures always cross regions', () => {
    let state = createGame('Manager', 'c9')
    for (let week = 0; week < 8; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const fixtures = state.fixtures.filter(
      (fixture) =>
        fixture.season === state.season &&
        fixture.week === 8 &&
        fixture.scope === 'international' &&
        fixture.bId,
    )
    expect(fixtures.length).toBeGreaterThan(0)
    expect(
      fixtures.every(
        (fixture) => state.teams[fixture.aId].region !== state.teams[fixture.bId!].region,
      ),
    ).toBeTrue()
  })
  test('a new season creates new Kickoff fixtures', { timeout: 10000 }, () => {
    let state = createGame('Manager', 'c9')
    for (let week = 0; week < 52; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    expect(state.season).toBe(2027)
    expect(fixturesForWeek(state, 1)).toHaveLength(16)
    // Stage 2 results decide who gets an opening bye, so check a team that plays in round 1.
    const opener = Object.keys(state.kickoff).find((id) => !state.kickoff[id].openingBye)!
    expect(nextFixtureForTeam(state, opener, 1)).toBeDefined()
  })
  test('Masters uses an eight-team Swiss stage and a complete double-elimination playoff', () => {
    let state = createGame('Manager', 'c9')
    for (let week = 0; week < 10; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const fixtures = state.fixtures.filter((fixture) => fixture.phase === 'Masters 1')
    const swiss = fixtures.filter((fixture) => fixture.stage === 'Swiss')
    const playoffs = fixtures.filter((fixture) => fixture.stage === 'Playoffs')
    expect(new Set(swiss.flatMap((fixture) => [fixture.aId, fixture.bId])).size).toBe(8)
    expect(swiss.filter((fixture) => fixture.label === 'Swiss Opening')).toHaveLength(4)
    expect(swiss.filter((fixture) => fixture.label === 'Swiss Decider')).toHaveLength(2)
    expect(
      swiss
        .filter((fixture) => fixture.label === 'Swiss Opening')
        .every((fixture) => state.teams[fixture.aId].region !== state.teams[fixture.bId!].region),
    ).toBeTrue()
    expect(playoffs).toHaveLength(14)
    expect(playoffs.filter((fixture) => fixture.label === 'Grand Final')).toHaveLength(1)
    expect(
      playoffs
        .filter((fixture) => fixture.label === 'Lower Final' || fixture.label === 'Grand Final')
        .every((fixture) => fixture.bestOf === 5),
    ).toBeTrue()
    expect(
      fixtures.every((fixture) => fixture.status === 'completed' && fixture.aId && fixture.bId),
    ).toBeTrue()
  })
  test('Champions resolves four groups before its double-elimination bracket', {
    timeout: 10000,
  }, () => {
    let state = createGame('Manager', 'c9')
    for (let week = 0; week < 42; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const fixtures = state.fixtures.filter((fixture) => fixture.phase === 'Champions')
    const groups = fixtures.filter((fixture) => fixture.stage === 'Groups')
    const playoffs = fixtures.filter((fixture) => fixture.stage === 'Playoffs')
    expect(groups).toHaveLength(20)
    for (const group of ['A', 'B', 'C', 'D'] as const) {
      const groupFixtures = groups.filter((fixture) => fixture.group === group)
      expect(groupFixtures).toHaveLength(5)
      expect(new Set(groupFixtures.flatMap((fixture) => [fixture.aId, fixture.bId]))).toHaveLength(
        4,
      )
    }
    expect(playoffs).toHaveLength(14)
    expect(playoffs.find((fixture) => fixture.label === 'Grand Final')?.status).toBe('completed')
    expect(fixtures.every((fixture) => fixture.aId && fixture.bId)).toBeTrue()
  })
})

describe('round-derived map statistics', () => {
  test('kills, deaths, and first events conserve across every map', () => {
    let maps = 0,
      players = 0,
      over300 = 0,
      competitiveMaps = 0
    for (let index = 0; index < 120; index++) {
      const state = createGame('Audit', 'sen')
      state.rng += index * 9973
      const result = simulateSeries(state, 'sen', 'g2', 1)
      for (const map of result.maps) {
        maps++
        const rows = Object.values(map.stats)
        players += rows.length
        const kills = rows.reduce((sum, row) => sum + row.kills, 0)
        const deaths = rows.reduce((sum, row) => sum + row.deaths, 0)
        const firstKills = rows.reduce((sum, row) => sum + row.firstKills, 0)
        const firstDeaths = rows.reduce((sum, row) => sum + row.firstDeaths, 0)
        expect(kills).toBe(deaths)
        expect(firstKills).toBe(firstDeaths)
        expect(firstKills).toBe(map.aScore + map.bScore)
        over300 += rows.filter((row) => row.acs >= 300).length
        if (map.aScore + map.bScore >= 23) {
          competitiveMaps++
          expect(Math.min(...rows.map((row) => row.deaths))).toBeGreaterThanOrEqual(12)
        }
      }
    }
    expect(maps).toBeGreaterThan(200)
    expect(competitiveMaps).toBeGreaterThan(20)
    expect(over300 / players).toBeLessThan(0.02)
  })
})
