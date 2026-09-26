import { beforeEach, describe, expect, test } from 'bun:test'
import { advanceWeek, createGame, type Fixture, type GameState } from '../src/game'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

const step = (state: GameState) => advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
const loser = (fixture: Fixture) => (fixture.winnerId === fixture.aId ? fixture.bId : fixture.aId)
const champions = (state: GameState) =>
  state.fixtures.filter(
    (fixture) => fixture.season === state.season && fixture.phase === 'Champions',
  )

// Checks one season's Champions: GSL groups of four, then a true double-elimination playoff.
function expectValidChampions(state: GameState) {
  const event = champions(state)
  const qualified = new Set<string>()
  for (const name of ['A', 'B', 'C', 'D']) {
    const group = event.filter((fixture) => fixture.group === name)
    const members = new Set(group.flatMap((fixture) => [fixture.aId, fixture.bId]))
    expect(members.size).toBe(4)
    const one = (stage: string) => group.filter((fixture) => fixture.label.endsWith(stage))
    const opening = one('Opening'),
      [winners] = one('Winners'),
      [elimination] = one('Elimination'),
      [decider] = one('Decider')
    expect(opening).toHaveLength(2)
    expect([winners.aId, winners.bId].sort()).toEqual(opening.map((f) => f.winnerId!).sort())
    expect([elimination.aId, elimination.bId].sort()).toEqual(opening.map(loser).sort() as string[])
    expect([decider.aId, decider.bId].sort()).toEqual(
      [loser(winners), elimination.winnerId].sort() as string[],
    )
    // Top two: the winners' match winner (2-0) and the decider winner (2-1).
    qualified.add(winners.winnerId!)
    qualified.add(decider.winnerId!)
  }
  const playoffs = event.filter((fixture) => fixture.stage === 'Playoffs')
  expect(new Set(playoffs.flatMap((fixture) => [fixture.aId, fixture.bId]))).toEqual(qualified)
  const losses = new Map<string, number>()
  const order = [
    'Upper Quarterfinal',
    'Upper Semifinal',
    'Lower Round 1',
    'Upper Final',
    'Lower Round 2',
    'Lower Round 3',
    'Lower Final',
    'Grand Final',
  ]
  for (const label of order)
    for (const fixture of playoffs.filter((f) => f.label === label)) {
      for (const id of [fixture.aId, fixture.bId as string]) {
        const lost = losses.get(id) ?? 0
        // Upper bracket teams are unbeaten; nobody plays on after two losses.
        expect(lost).toBeLessThan(fixture.bracket === 'Upper' ? 1 : 2)
      }
      const out = loser(fixture) as string
      losses.set(out, (losses.get(out) ?? 0) + 1)
    }
  const [final] = playoffs.filter((fixture) => fixture.label === 'Grand Final')
  expect(final.status).toBe('completed')
  // Everyone but the champion is knocked out with exactly two losses, except the final loser.
  for (const id of qualified)
    if (id !== final.winnerId && id !== loser(final)) expect(losses.get(id)).toBe(2)
}

describe('Champions format', () => {
  test('groups stay fixed and playoffs are double elimination, including in later seasons', {
    timeout: 60000,
  }, () => {
    let state = createGame('Manager', 'c9')
    while (state.week <= 42) state = step(state)
    expectValidChampions(state)
    const first = state.season
    while (state.season === first || state.week <= 42) state = step(state)
    expect(state.season).toBe(first + 1)
    expectValidChampions(state)
  })
})
