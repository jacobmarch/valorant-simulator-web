import type { GameState, Team } from './game'

/**
 * How far the managed club may run a negative balance before the board fires the manager.
 * Starting cash is $1.0M–$1.55M and a typical payroll is about $1M a year, so half a starting
 * balance gives a real runway without letting the balance drift indefinitely.
 */
export const DEBT_LIMIT = 500_000

/** Teams the board offers the fired manager, the weakest clubs that are replacing their coaches. */
export const FIRED_TEAM_OPTIONS = 4

/** The managed club may borrow down to -DEBT_LIMIT; every other organization needs the cash on hand. */
export function cashFloor(state: GameState, team: Team) {
  return team.id === state.currentTeamId ? -DEBT_LIMIT : 0
}

/** Whether `team` can pay `cost` now without breaching its cash floor. */
export function canAfford(state: GameState, team: Team, cost: number) {
  return team.cash - cost >= cashFloor(state, team)
}

/** True when the managed club's balance has crossed the debt limit. */
export function pastDebtLimit(team: Team) {
  return team.cash < -DEBT_LIMIT
}
