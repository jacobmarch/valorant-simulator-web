// Prize money for every event, paid to every team as soon as the event's final is played.
// Winning is where the big money is: a Champions title pays $1M and a Masters title $500k,
// which is what a roster full of stars needs to stay in the black.
import { eventFinish, type Fixture, type GameState, regions } from './game'
import type { Region } from './seed'

type PrizeEvent = Fixture['phase']
/** Payouts by finishing place: 1st, 2nd, 3rd, 4th, 5th-6th (x2), 7th-8th (x2). */
export const PRIZES: Record<PrizeEvent, number[]> = {
  // The three Masters 1 seeds, then the Lower Final loser.
  Kickoff: [100000, 100000, 100000, 40000],
  'Stage 1': [150000, 90000, 60000, 40000, 25000, 25000, 15000, 15000],
  'Stage 2': [150000, 90000, 60000, 40000, 25000, 25000, 15000, 15000],
  'Masters 1': [500000, 250000, 150000, 100000, 60000, 60000, 40000, 40000],
  'Masters 2': [500000, 250000, 150000, 100000, 60000, 60000, 40000, 40000],
  Champions: [1000000, 500000, 300000, 200000, 120000, 120000, 80000, 80000],
}
const events: PrizeEvent[] = [
  'Kickoff',
  'Stage 1',
  'Stage 2',
  'Masters 1',
  'Masters 2',
  'Champions',
]
const placeNames = ['1st', '2nd', '3rd', '4th', '5th–6th', '5th–6th', '7th–8th', '7th–8th']
const dollars = (value: number) => `$${value.toLocaleString('en-US')}`

/** The fixture that ends an event: the Grand Final, or the Kickoff Lower Final. */
function closingFixture(state: GameState, phase: PrizeEvent, region?: Region) {
  const label = phase === 'Kickoff' ? 'Lower Final' : 'Grand Final'
  return state.fixtures.find(
    (fixture) =>
      fixture.season === state.season &&
      fixture.phase === phase &&
      fixture.label === label &&
      fixture.status === 'completed' &&
      (phase === 'Kickoff' || fixture.stage === 'Playoffs') &&
      (!region || fixture.region === region),
  )
}
function eventRuns(phase: PrizeEvent): Array<Region | undefined> {
  return phase === 'Masters 1' || phase === 'Masters 2' || phase === 'Champions'
    ? [undefined]
    : regions
}

/** Every payout already made this season, event by event. */
export function seasonPrizes(state: GameState, teamId: string) {
  return events.flatMap((phase) =>
    eventRuns(phase).flatMap((region) => {
      if (!closingFixture(state, phase, region)?.prizePaid) return []
      const index = eventFinish(state, phase, region).indexOf(teamId)
      const amount = index >= 0 ? (PRIZES[phase][index] ?? 0) : 0
      return amount ? [{ phase, place: placeNames[index], amount }] : []
    }),
  )
}

/** Pays each event that finished since the last check. Safe to call every week. */
export function payEventPrizes(state: GameState) {
  events.forEach((phase) =>
    eventRuns(phase).forEach((region) => {
      const closing = closingFixture(state, phase, region)
      if (!closing || closing.prizePaid) return
      const finish = eventFinish(state, phase, region)
      if (finish.slice(0, 4).some((id) => !id)) return
      closing.prizePaid = true
      finish.forEach((id, index) => {
        const amount = PRIZES[phase][index] ?? 0
        const team = id ? state.teams[id] : undefined
        if (!team || !amount) return
        team.cash += amount
        if (team.id === state.currentTeamId)
          state.inbox.unshift(
            `Prize money: ${team.name} earned ${dollars(amount)} for finishing ${placeNames[index]} at ${phase}.`,
          )
      })
    }),
  )
}
