import { describe, expect, test } from 'bun:test'
import { nextAction } from '../src/flow'
import { advanceWeek, createGame, phaseForWeek } from '../src/game'
import {
  derivePlayer,
  importRoster,
  numeric,
  type PlayerDatabase,
  validateDatabase,
} from '../src/player-database'
import { seedTeams } from '../src/seed'
import { rosterViolations } from '../src/transfers'
import { fillRoster } from './helpers'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})

function fixture(): PlayerDatabase {
  return {
    version: 1,
    fetchedAt: '2026-09-30T12:00:00Z',
    source: 'http://localhost:3001',
    timespan: '90d',
    model: 'vlr-proxies-v1',
    teams: seedTeams.map((team, index) => ({
      id: team.id,
      name: team.name,
      vlrId: String(index + 1),
    })),
    players: seedTeams.flatMap((team, teamIndex) =>
      Array.from({ length: 5 }, (_, index) => ({
        id: `vlr-${teamIndex * 5 + index + 1}`,
        name: `Real ${teamIndex}-${index}`,
        teamId: team.id,
        status: 'starter' as const,
        primaryRole: 'Sentinel' as const,
        secondaryRoles: [],
        ratings: {
          Mechanics: 85,
          Tactics: 73,
          Utility: 75,
          Consistency: 80,
          Clutch: 70,
          Teamplay: 79,
        },
        evidence: {
          url: `https://www.vlr.gg/player/${teamIndex * 5 + index + 1}`,
          rounds: 1000,
          agentStats: [],
          unmeasured: ['Clutch'],
        },
      })),
    ),
  }
}

describe('VLR database', () => {
  test('imports 5–10 active players while keeping exactly five game starters', () => {
    for (const count of [5, 8, 10]) {
      const active = Array.from({ length: count }, (_, index) => ({
        id: String(index + 1),
        alias: `Player ${index}`,
      }))
      const imported = importRoster(active, [], 'ENVY')
      expect(imported.length).toBe(count)
      expect(imported.filter((row) => row.status === 'starter').length).toBe(5)
      expect(imported.map((row) => row.member.id)).toEqual(active.map((row) => row.id))
    }
  })
  test('excludes staff, preserves bench players, and rejects rosters outside the limits', () => {
    const active = Array.from({ length: 8 }, (_, index) => ({
      id: String(index + 1),
      alias: `Player ${index}`,
    }))
    const imported = importRoster(
      [...active, { id: '100', alias: 'Coach', is_staff: true }],
      [{ id: '9', alias: 'Reserve' }],
      'ENVY',
    )
    expect(imported.length).toBe(9)
    expect(imported[8].status).toBe('substitute')
    expect(importRoster(active.slice(0, 3), [], 'ENVY').length).toBe(3)
    expect(importRoster([], [], 'ENVY')).toEqual([])
    expect(() => importRoster([...active, ...active.slice(0, 3)], [], 'ENVY')).toThrow()
    expect(() => importRoster(active, active.slice(0, 3), 'ENVY')).toThrow()
  })
  test('eight and ten player careers retain reserves and field five players', () => {
    for (const count of [8, 10]) {
      const db = fixture()
      for (let index = 5; index < count; index++)
        db.players.push({
          ...structuredClone(db.players[0]),
          id: `vlr-${1000 + index}`,
          status: 'substitute',
        })
      const teamId = db.players[0].teamId
      validateDatabase(db)
      const state = createGame('Manager', teamId, db)
      expect(state.teams[teamId].playerIds.length).toBe(count)
      expect(state.teams[teamId].lineup.length).toBe(5)
      expect(
        state.teams[teamId].playerIds.filter((id) => state.players[id].status === 'substitute')
          .length,
      ).toBe(count - 5)
    }
    const oversized = fixture()
    for (let index = 0; index < 6; index++)
      oversized.players.push({
        ...structuredClone(oversized.players[0]),
        id: `vlr-${2000 + index}`,
        status: 'substitute',
      })
    expect(() => validateDatabase(oversized)).toThrow()
  })
  test('parses percentages and missing values without inventing zeros', () => {
    expect(numeric('71%')).toBe(71)
    expect(numeric('1,200')).toBe(1200)
    expect(numeric('.8')).toBe(0.8)
    for (const value of ['', '-', null, 'NaN']) expect(numeric(value)).toBeNull()
  })
  test('weights agent roles by rounds, handles KAY/O, and excludes zero-round rows', () => {
    const result = derivePlayer([
      { agent: 'Jett', rounds: '100', acs: '300' },
      { agent: 'KAY/O', rounds: '900', acs: '200' },
      { agent: 'Cypher', rounds: '0', acs: '999' },
    ])
    expect(result.primaryRole).toBe('Initiator')
    expect(result.secondaryRoles).toEqual([])
    expect(result.rounds).toBe(1000)
    expect(result.ratings.Mechanics).toBeLessThan(75)
    expect(result.ratings.Clutch).toBe(70)
  })
  test('shrinks small samples more than large samples and leaves missing metrics neutral', () => {
    expect(
      derivePlayer([{ agent: 'Jett', rounds: '20', acs: '300' }]).ratings.Mechanics,
    ).toBeLessThan(derivePlayer([{ agent: 'Jett', rounds: '2000', acs: '300' }]).ratings.Mechanics)
    expect(derivePlayer([]).primaryRole).toBe('Flex')
    expect(Object.values(derivePlayer([]).ratings)).toEqual([70, 70, 70, 70, 70, 70])
  })
  test('rejects duplicates, incomplete teams, short rosters, and nonfinite ratings', () => {
    const duplicate = fixture()
    duplicate.players[1].id = duplicate.players[0].id
    expect(() => validateDatabase(duplicate)).toThrow()
    const missing = fixture()
    missing.teams.pop()
    expect(() => validateDatabase(missing)).toThrow()
    const starters = fixture()
    starters.players.push({ ...structuredClone(starters.players[0]), id: 'vlr-999' })
    expect(() => validateDatabase(starters)).toThrow()
    const invalid = fixture()
    invalid.players[0].ratings.Mechanics = NaN
    expect(() => validateDatabase(invalid)).toThrow()
  })
  test('new careers replace seed rosters and preserve evidence without mutating the database', () => {
    const db = fixture()
    const original = JSON.stringify(db)
    const state = createGame('Manager', 'sen', db)
    expect(state.teams.sen.lineup.length).toBe(5)
    expect(state.players['sen-0']).toBeUndefined()
    const id = state.teams.sen.lineup[0]
    expect(state.players[id].ratings.Mechanics).toBe(85)
    expect(state.players[id].primaryRole).toBe('Sentinel')
    expect(state.players[id].realData?.fetchedAt).toBe(db.fetchedAt)
    state.players[id].ratings.Mechanics = 99
    expect(JSON.stringify(db)).toBe(original)
  })
  test('offseason rosters import unchanged and AI teams fill vacancies before Kickoff', () => {
    const db = fixture()
    db.players = db.players.filter((player) => Number(player.id.slice(4)) % 5 < 3)
    const original = JSON.stringify(db)
    validateDatabase(db)
    const initial = createGame('Manager', 'c9', db)
    expect(initial.week).toBe(1)
    expect(phaseForWeek(initial.week)).toBe('Break')
    expect(initial.fixtures.length).toBe(0)
    expect(initial.teams.c9.playerIds.length).toBe(3)
    expect(nextAction(initial).blocked).toBeUndefined()
    const kickoff = advanceWeek(initial, 'Measured defaults', 'Disciplined retakes')
    expect(kickoff.week).toBe(2)
    expect(kickoff.matches.length).toBe(0)
    for (const team of Object.values(kickoff.teams).filter((team) => team.id !== 'c9')) {
      expect(team.playerIds.length).toBeGreaterThanOrEqual(5)
      expect(team.lineup.length).toBe(5)
      expect(rosterViolations(kickoff, team.id)).toEqual([])
    }
    expect(kickoff.transfers.filter((move) => move.kind === 'signing').length).toBeGreaterThan(12)
    expect(kickoff.teams.c9.playerIds.length).toBe(3)
    expect(nextAction(kickoff).blocked).toBeTrue()
    expect(advanceWeek(kickoff, 'Measured defaults', 'Disciplined retakes')).toBe(kickoff)
    const ready = fillRoster(kickoff)
    expect(nextAction(ready).blocked).toBeUndefined()
    expect(
      advanceWeek(ready, 'Measured defaults', 'Disciplined retakes').matches.length,
    ).toBeGreaterThan(0)
    expect(JSON.stringify(db)).toBe(original)
  })
  test('allows an empty roster in the offseason database', () => {
    const db = fixture()
    db.players = db.players.filter((player) => player.teamId !== 'envy')
    validateDatabase(db)
    const initial = createGame('Manager', 'c9', db)
    expect(initial.teams.envy.playerIds).toEqual([])
    const kickoff = advanceWeek(initial, 'Measured defaults', 'Disciplined retakes')
    expect(kickoff.teams.envy.playerIds.length).toBeGreaterThanOrEqual(5)
    expect(kickoff.teams.envy.lineup.length).toBe(5)
  })
  test('eligible reserves can complete the game lineup without inventing players', () => {
    const db = fixture()
    for (const player of db.players.filter((player) => player.teamId === 'c9').slice(3))
      player.status = 'substitute'
    const state = createGame('Manager', 'c9', db)
    expect(state.teams.c9.playerIds.length).toBe(5)
    expect(state.teams.c9.lineup.length).toBe(5)
    expect(rosterViolations(state, 'c9')).toEqual([])
  })
  test('an empty managed roster has enough eligible free agents to enter Kickoff', () => {
    const db = fixture()
    db.players = db.players.filter((player) => player.teamId !== 'c9')
    const state = advanceWeek(
      createGame('Manager', 'c9', db),
      'Measured defaults',
      'Disciplined retakes',
    )
    expect(state.teams.c9.playerIds.length).toBe(0)
    const ready = fillRoster(state)
    expect(ready.teams.c9.lineup.length).toBe(5)
    expect(rosterViolations(ready, 'c9')).toEqual([])
  })
})
