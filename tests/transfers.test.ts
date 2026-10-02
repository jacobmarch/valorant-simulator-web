import { beforeEach, describe, expect, test } from 'bun:test'
import { MORALE_DEFAULT } from '../src/development'
import { advanceWeek, createGame, type GameState } from '../src/game'
import {
  buyOutPlayer,
  contractValue,
  freeAgents,
  MAX_ROSTER,
  MIN_ROSTER,
  newContractSalary,
  playerOverall,
  releasePlayer,
  rosterHistory,
  rosterViolations,
  runAiTransfers,
  salaryDemand,
  salaryForOverall,
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
    expect(transferWindowForWeek(2)?.label).toBe('Preseason window')
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
    expect(next.players['sen-1'].salary).toBe(newContractSalary(target))
    expect(next.players['sen-1'].salary).toBeGreaterThanOrEqual(target.salary)
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
    state.teams.c9.cash = 100_000_000
    let next = state
    const targets = Object.values(state.players).filter(
      (player) =>
        player.teamId && player.teamId !== 'c9' && player.region === 'Americas' && !player.isImport,
    )
    const capacity = MAX_ROSTER - state.teams.c9.playerIds.length
    for (const player of targets.slice(0, capacity))
      next = expectOk(buyOutPlayer(next, 'c9', player.id))
    expect(next.teams.c9.playerIds).toHaveLength(MAX_ROSTER)
    expect(expectError(buyOutPlayer(next, 'c9', targets[capacity].id))).toContain('maximum roster')
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

describe('free-agent pool', () => {
  test('generated prospects carry age, potential, form and morale', () => {
    const state = createGame('Manager', 'c9')
    const prospects = freeAgents(state).filter((player) => player.id.startsWith('prospect-'))
    expect(prospects.length).toBeGreaterThan(0)
    prospects.forEach((player) => {
      expect(player.age).toBeGreaterThanOrEqual(17)
      expect(player.potential).toBeGreaterThanOrEqual(playerOverall(player))
      expect(player.form).toBe(0)
      expect(player.morale).toBe(MORALE_DEFAULT)
    })
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

describe('salary demands', () => {
  test('asking salaries climb steeply with overall', () => {
    expect(salaryForOverall(75)).toBe(120000)
    expect(salaryForOverall(85)).toBeGreaterThan(salaryForOverall(75) * 2.5)
    expect(salaryForOverall(90)).toBeGreaterThan(salaryForOverall(85) * 1.5)
    expect(salaryForOverall(40)).toBe(25000)
  })

  test('seeded players are paid by rating', () => {
    const state = createGame('Manager', 'c9')
    const contracted = Object.values(state.players).filter((player) => player.teamId)
    contracted.forEach((player) => expect(player.salary).toBe(salaryDemand(player)))
    const [best] = [...contracted].sort((a, b) => playerOverall(b) - playerOverall(a))
    const [worst] = [...contracted].sort((a, b) => playerOverall(a) - playerOverall(b))
    expect(best.salary).toBeGreaterThan(worst.salary * 3)
  })

  test('a free agent signs at their current asking salary', () => {
    const state = createGame('Manager', 'c9')
    state.teams.c9.cash = 10_000_000
    const agent = freeAgents(state)[0]
    agent.ratings = { ...agent.ratings, Mechanics: 95, Tactics: 95 }
    expect(contractValue(agent)).toBe(Math.round((salaryDemand(agent) * agent.years) / 1000) * 1000)
    const next = expectOk(signFreeAgent(state, 'c9', agent.id))
    expect(next.players[agent.id].salary).toBe(salaryDemand(agent))
  })
})

describe('AI buyout churn', () => {
  test('a player is not bought out again within a season of moving', { timeout: 15000 }, () => {
    let state = createGame('Manager', 'c9')
    while (state.week <= 52 && state.season === 2026)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const buyouts = new Map<string, number>()
    state.transfers
      .filter((move) => move.kind === 'buyout' && move.season === 2026)
      .forEach((move) => buyouts.set(move.playerId, (buyouts.get(move.playerId) ?? 0) + 1))
    expect(buyouts.size).toBeGreaterThan(0)
    expect(Math.max(...buyouts.values())).toBeLessThanOrEqual(2)
  })
})
