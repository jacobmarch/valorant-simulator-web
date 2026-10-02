import { describe, expect, test } from 'bun:test'
import { createGame } from '../src/game'
import {
  derivePlayer,
  numeric,
  type PlayerDatabase,
  validateDatabase,
} from '../src/player-database'
import { seedTeams } from '../src/seed'

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
    const short = fixture()
    short.players.pop()
    expect(() => validateDatabase(short)).toThrow()
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
})
