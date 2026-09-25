import { beforeEach, describe, expect, test } from 'bun:test'
import { advanceWeek, createGame, type GameState } from '../src/game'
import {
  MIN_ROSTER,
  buyOutPlayer,
  contractValue,
  freeAgents,
  releasePlayer,
  rosterHistory,
  rosterViolations,
  runAiTransfers,
  setPlayerStatus,
  signFreeAgent,
  transferWindowForWeek,
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

const expectOk = (outcome: ReturnType<typeof signFreeAgent>) => {
  if (!outcome.ok) throw new Error(outcome.error)
  return outcome.state
}
const expectError = (outcome: ReturnType<typeof signFreeAgent>) => {
  if (outcome.ok) throw new Error('Expected the move to be rejected')
  return outcome.error
}
const allLegal = (state: GameState) =>
  Object.keys(state.teams).flatMap((id) => rosterViolations(state, id))

describe('transfer windows', () => {
  test('windows are configured by calendar week', () => {
    expect(transferWindowForWeek(1)?.label).toBe('Preseason window')
    expect(transferWindowForWeek(2)).toBeNull()
    expect(transferWindowForWeek(11)?.label).toBe('Stage 1 window')
    expect(transferWindowForWeek(45)?.label).toBe('Offseason window')
  })
  test('signings outside a window explain when the next window opens', () => {
    const state = createGame('Manager', 'c9')
    state.week = 3
    const error = expectError(signFreeAgent(state, 'c9', freeAgents(state)[0].id))
    expect(error).toContain('transfer window is closed in week 3')
    expect(error).toContain('Stage 1 window opens in week 11')
  })
})

describe('buyouts', () => {
  test('buyer pays seller the salary times remaining years and takes the contract', () => {
    const state = createGame('Manager', 'c9')
    const target = state.players['sen-1']
    const fee = contractValue(target)
    expect(fee).toBe(Math.round((target.salary * target.years) / 1000) * 1000)
    const buyerCash = state.teams.c9.cash,
      sellerCash = state.teams.sen.cash
    const next = expectOk(buyOutPlayer(state, 'c9', 'sen-1'))
    expect(next.teams.c9.cash).toBe(buyerCash - fee)
    // The seller spends part of the fee signing a replacement, so compare via history.
    const moves = rosterHistory(next, 'sen')
    const replacement = moves.find((move) => move.kind === 'signing' && move.toTeamId === 'sen')
    expect(next.teams.sen.cash).toBe(sellerCash + fee - (replacement?.fee ?? 0))
    expect(next.players['sen-1'].teamId).toBe('c9')
    expect(next.players['sen-1'].salary).toBe(target.salary)
    expect(next.players['sen-1'].years).toBe(target.years)
    expect(next.teams.c9.playerIds).toContain('sen-1')
    expect(next.teams.sen.playerIds).not.toContain('sen-1')
    expect(next.teams.sen.playerIds.length).toBeGreaterThanOrEqual(MIN_ROSTER)
    expect(rosterViolations(next, 'sen')).toEqual([])
    expect(rosterViolations(next, 'c9')).toEqual([])
    expect(moves.some((move) => move.kind === 'buyout' && move.fee === fee)).toBe(true)
  })
  test('buyouts require enough cash and roster space', () => {
    const state = createGame('Manager', 'c9')
    state.teams.c9.cash = 1000
    expect(expectError(buyOutPlayer(state, 'c9', 'sen-1'))).toContain('buyout is')
    state.teams.c9.cash = 10_000_000
    let next = state
    for (const id of ['sen-2', 'sen-3']) next = expectOk(buyOutPlayer(next, 'c9', id))
    expect(next.teams.c9.playerIds).toHaveLength(7)
    expect(expectError(buyOutPlayer(next, 'c9', 'sen-4'))).toContain('maximum roster')
  })
  test('cross-region buyouts respect the import limit', () => {
    const state = createGame('Manager', 'c9')
    state.teams.c9.cash = 10_000_000
    const emea = Object.values(state.players).filter(
      (player) => player.region === 'EMEA' && player.teamId && !player.isImport,
    )
    const next = expectOk(buyOutPlayer(state, 'c9', emea[0].id))
    expect(next.players[emea[0].id].isImport).toBe(true)
    expect(expectError(buyOutPlayer(next, 'c9', emea[1].id))).toContain('the limit is 1')
  })
  test("AI sellers backfill, but the manager's team cannot drop below the minimum", () => {
    const state = createGame('Manager', 'c9')
    state.teams.sen.cash = 10_000_000
    expect(expectError(buyOutPlayer(state, 'sen', 'c9-0'))).toContain('minimum roster is 5')
    state.currentTeamId = 'sen'
    const next = expectOk(buyOutPlayer(state, 'sen', 'c9-0'))
    expect(next.teams.c9.playerIds).toHaveLength(MIN_ROSTER)
    expect(rosterViolations(next, 'c9')).toEqual([])
  })
})

describe('releases and status changes', () => {
  test('releasing below five players names the failed rule', () => {
    const state = createGame('Manager', 'c9')
    expect(expectError(releasePlayer(state, 'c9', 'c9-0'))).toContain('minimum roster is 5')
  })
  test('sign then release keeps a legal lineup and records every move', () => {
    const state = createGame('Manager', 'c9')
    const agent = freeAgents(state).sort((a, b) => contractValue(a) - contractValue(b))[0]
    let next = expectOk(signFreeAgent(state, 'c9', agent.id))
    expect(next.players[agent.id].status).toBe('substitute')
    expect(next.teams.c9.lineup).toHaveLength(5)
    next = expectOk(setPlayerStatus(next, 'c9', 'c9-0', 'inactive'))
    expect(next.teams.c9.lineup).toContain(agent.id)
    expect(next.teams.c9.lineup).not.toContain('c9-0')
    expect(expectError(setPlayerStatus(next, 'c9', 'c9-1', 'inactive'))).toContain(
      'fewer than five active players',
    )
    expect(expectError(releasePlayer(next, 'c9', 'c9-1'))).toContain('a match needs 5')
    next = expectOk(releasePlayer(next, 'c9', 'c9-0'))
    expect(next.players['c9-0'].status).toBe('free-agent')
    expect(rosterViolations(next, 'c9')).toEqual([])
    expect(rosterHistory(next, 'c9').map((move) => move.kind)).toEqual([
      'release',
      'status',
      'signing',
    ])
  })
  test('a sixth starter is rejected with the reason', () => {
    const state = createGame('Manager', 'c9')
    const agent = freeAgents(state).sort((a, b) => contractValue(a) - contractValue(b))[0]
    const next = expectOk(signFreeAgent(state, 'c9', agent.id))
    expect(expectError(setPlayerStatus(next, 'c9', agent.id, 'starter'))).toContain(
      'already has five starters',
    )
  })
})

describe('AI roster moves', () => {
  test('AI teams make legal moves during windows and never touch the manager', () => {
    const state = createGame('Manager', 'c9')
    const before = [...state.teams.c9.playerIds]
    for (let pass = 0; pass < 6; pass++) runAiTransfers(state)
    const aiMoves = rosterHistory(state).filter((move) => move.kind !== 'status')
    expect(aiMoves.length).toBeGreaterThan(0)
    expect(state.teams.c9.playerIds).toEqual(before)
    expect(allLegal(state)).toEqual([])
  })
  test('AI teams do nothing while the window is closed', () => {
    const state = createGame('Manager', 'c9')
    state.week = 3
    runAiTransfers(state)
    expect(rosterHistory(state)).toEqual([])
  })
  test('seasons keep playing with legal rosters after AI windows', () => {
    let state = createGame('Manager', 'c9')
    for (let week = 0; week < 12; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    expect(state.week).toBe(13)
    expect(rosterHistory(state).length).toBeGreaterThan(0)
    expect(allLegal(state)).toEqual([])
  })
})
