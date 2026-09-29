import { beforeEach, describe, expect, test } from 'bun:test'
import { advanceWeek, createGame, loadGame, rolloverSeason, SAVE_KEY } from '../src/game'
import { attentionItems, nextAction } from '../src/flow'
import {
  cancelRenewal,
  canRenegotiate,
  freeAgents,
  renegotiateContract,
  rosterBlock,
  rosterShortfall,
  rosterViolations,
  salaryDemand,
  signFreeAgent,
  type TransferOutcome,
} from '../src/transfers'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

const expectOk = (outcome: TransferOutcome) => {
  if (!outcome.ok) throw new Error(outcome.error)
  return outcome.state
}
const expectError = (outcome: TransferOutcome) => {
  if (outcome.ok) throw new Error('expected an error')
  return outcome.error
}

describe('season rollover', () => {
  test('players age and contract years count down', () => {
    const state = createGame('Manager', 'c9')
    const before = structuredClone(state.players)
    rolloverSeason(state)
    expect(state.season).toBe(2027)
    expect(state.week).toBe(1)
    Object.values(state.players).forEach((player) => {
      expect(player.age).toBe(before[player.id].age + 1)
      if (before[player.id].teamId && before[player.id].years > 1)
        expect(player.years).toBe(before[player.id].years - 1)
    })
  })

  test('Championship Points and season records reset', () => {
    const state = createGame('Manager', 'c9')
    Object.values(state.teams).forEach((team) => {
      team.championshipPoints = 7
      team.wins = 4
      team.losses = 2
      team.mapWins = 9
      team.mapLosses = 5
    })
    rolloverSeason(state)
    Object.values(state.teams).forEach((team) => {
      expect(team.championshipPoints).toBe(0)
      expect([team.wins, team.losses, team.mapWins, team.mapLosses]).toEqual([0, 0, 0, 0])
    })
  })

  test('expired managed contracts leave unless renegotiated, even below five', () => {
    const state = createGame('Manager', 'c9')
    const team = state.teams.c9
    const [bench1, bench2] = ['tier2-0', 'tier2-1']
    ;[bench1, bench2].forEach((id) => {
      team.playerIds.push(id)
      Object.assign(state.players[id], { teamId: 'c9', status: 'substitute', years: 3 })
    })
    const expiring = team.lineup.slice(0, 3)
    team.playerIds.forEach((id) => {
      if (!expiring.includes(id) && id !== bench1 && id !== bench2) state.players[id].years = 3
    })
    expiring.forEach((id) => {
      state.players[id].years = 1
    })
    state.week = 44
    const kept = expectOk(renegotiateContract(state, expiring[0], 2))
    rolloverSeason(kept)
    // Seven players, three expire, one is re-signed: two walk and nobody is forced to stay.
    expect(kept.teams.c9.playerIds).toHaveLength(5)
    const walked = expiring.slice(1)
    walked.forEach((id) => {
      expect(kept.players[id].teamId).toBeNull()
      expect(kept.players[id].status).toBe('free-agent')
    })
    const stayed = kept.players[expiring[0]]
    expect(stayed.teamId).toBe('c9')
    expect(stayed.years).toBe(2)
    expect(stayed.renewal).toBeUndefined()
    expect(kept.inbox.some((line) => line.startsWith('Contracts expired'))).toBeTrue()
  })

  test('the roster can fall below five and the calendar waits until it is filled', () => {
    const state = createGame('Manager', 'c9')
    const team = state.teams.c9
    team.playerIds.forEach((id) => {
      state.players[id].years = 3
    })
    team.lineup.slice(0, 3).forEach((id) => {
      state.players[id].years = 1
    })
    rolloverSeason(state)
    expect(team.playerIds).toHaveLength(2)
    expect(rosterShortfall(state)).toBe(3)
    expect(rosterBlock(state)).toContain('needs 3 more players')
    expect(state.inbox.some((line) => line.includes('before Kickoff'))).toBeTrue()
    expect(nextAction(state).blocked).toBeTrue()
    expect(attentionItems(state)[0].id).toBe('roster-short')
    // Nothing moves while the roster is short.
    expect(advanceWeek(state, 'Measured defaults', 'Disciplined retakes')).toBe(state)
    state.teams.c9.cash = 10_000_000
    let next = state
    freeAgents(state)
      .slice(0, 3)
      .forEach((agent) => {
        next = expectOk(signFreeAgent(next, 'c9', agent.id))
      })
    expect(rosterShortfall(next)).toBe(0)
    expect(rosterViolations(next, 'c9')).toEqual([])
    expect(advanceWeek(next, 'Measured defaults', 'Disciplined retakes').week).toBe(2)
  })

  test('contracts can only be renegotiated in the offseason, for a limited term', () => {
    const state = createGame('Manager', 'c9')
    const player = state.players[state.teams.c9.lineup[0]]
    player.years = 1
    player.age = 31
    expect(canRenegotiate(state, player)).toBeFalse()
    expect(expectError(renegotiateContract(state, player.id, 1))).toContain('week 43')
    state.week = 43
    expect(canRenegotiate(state, player)).toBeTrue()
    expect(expectError(renegotiateContract(state, player.id, 3))).toContain('only sign for 1 year')
    player.age = 25
    const next = expectOk(renegotiateContract(state, player.id, 2))
    expect(next.players[player.id].renewal).toEqual({ years: 2, salary: salaryDemand(player) })
    expect(cancelRenewal(next, player.id).players[player.id].renewal).toBeUndefined()
    player.years = 2
    expect(expectError(renegotiateContract(state, player.id, 1))).toContain('still has 2 years')
  })

  test('AI teams keep their expiring starters', () => {
    const state = createGame('Manager', 'c9')
    const team = state.teams.fnc
    team.lineup.forEach((id) => {
      state.players[id].years = 1
    })
    rolloverSeason(state)
    expect(team.lineup).toHaveLength(5)
    team.lineup.forEach((id) => {
      expect(state.players[id].teamId).toBe('fnc')
      expect(state.players[id].years).toBeGreaterThan(0)
    })
  })

  test('every roster stays legal after a full season', { timeout: 15000 }, () => {
    let state = createGame('Manager', 'c9')
    const ages = Object.fromEntries(Object.values(state.players).map((p) => [p.id, p.age]))
    for (let week = 0; week < 52; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    expect(state.season).toBe(2027)
    expect(
      state.inbox.some((line) => line.startsWith('Contracts expiring after season 2026')),
    ).toBeTrue()
    Object.values(state.teams).forEach((team) => {
      expect(team.championshipPoints).toBe(0)
      // The manager may be short of players until Kickoff; AI clubs always field five.
      if (team.id === state.currentTeamId) return
      expect(team.playerIds.length).toBeGreaterThanOrEqual(5)
      expect(team.lineup).toHaveLength(5)
      team.playerIds.forEach((id) => {
        expect(state.players[id].years).toBeGreaterThan(0)
        expect(state.players[id].teamId).toBe(team.id)
      })
    })
    // Prospects generated by in-season transfer windows were not in the starting pool.
    Object.values(state.players)
      .filter((player) => player.id in ages)
      .forEach((player) => {
        expect(player.age).toBe(ages[player.id] + 1)
      })
    const rolloverMoves = state.transfers.filter(
      (move) => move.season === 2027 && (move.kind === 'expiry' || move.kind === 'renewal'),
    )
    expect(rolloverMoves.length).toBeGreaterThan(0)
  })

  test('older saves gain player ages on load', () => {
    const state = createGame('Manager', 'c9') as unknown as {
      version: number
      players: Record<string, { age?: number }>
    }
    state.version = 8
    Object.values(state.players).forEach((player) => {
      delete player.age
    })
    memory.set(SAVE_KEY, JSON.stringify(state))
    const loaded = loadGame()!
    expect(loaded.version).toBe(16)
    Object.values(loaded.players).forEach((player) => {
      expect(player.age).toBeGreaterThanOrEqual(17)
    })
  })
})
