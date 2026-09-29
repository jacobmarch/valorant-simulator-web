import { advanceWeek, type GameState } from '../src/game'
import { freeAgents, playerOverall, rosterShortfall, signFreeAgent } from '../src/transfers'

/** Signs the best free agents until the managed team can field five, as a manager would in preseason. */
export function fillRoster(state: GameState): GameState {
  let next = state
  while (rosterShortfall(next)) {
    next.teams[next.currentTeamId].cash = Math.max(next.teams[next.currentTeamId].cash, 5_000_000)
    const candidates = freeAgents(next).sort((a, b) => playerOverall(b) - playerOverall(a))
    let signed: GameState | null = null
    for (const agent of candidates) {
      const outcome = signFreeAgent(next, next.currentTeamId, agent.id)
      if (outcome.ok) {
        signed = outcome.state
        break
      }
    }
    if (!signed) throw new Error('no free agent could be signed')
    next = signed
  }
  return next
}

/** One week forward, filling the roster first so multi-season runs never stall at Kickoff. */
export const stepWeek = (state: GameState) =>
  advanceWeek(fillRoster(state), 'Measured defaults', 'Disciplined retakes')
