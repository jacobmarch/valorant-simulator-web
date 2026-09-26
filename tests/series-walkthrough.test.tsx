import { beforeEach, describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { createGame, playableTournamentFixtureIds, simulateTournamentFixture } from '../src/game'
import { SeriesWalkthrough, SimChoice } from '../src/series-walkthrough'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

describe('map-by-map sim', () => {
  test('offers quick sim or map by map for a single series', () => {
    const state = createGame('Manager', 'sen')
    const fixture = state.fixtures.find((f) => f.id === playableTournamentFixtureIds(state)[0])
    if (!fixture) throw new Error('no playable fixture')
    const html = renderToStaticMarkup(
      <SimChoice
        s={state}
        fixture={fixture}
        onQuick={() => {}}
        onMapByMap={() => {}}
        onClose={() => {}}
      />,
    )
    expect(html).toContain('Quick sim')
    expect(html).toContain('Map by map')
  })
  test('starts on the veto with the series score hidden', () => {
    const state = createGame('Manager', 'sen')
    const fixtureId = playableTournamentFixtureIds(state)[0]
    const next = simulateTournamentFixture(
      state,
      fixtureId,
      'Measured defaults',
      'Disciplined retakes',
    )
    const resultId = next.fixtures.find((f) => f.id === fixtureId)?.resultId
    const match = next.matches.find((m) => m.id === resultId)
    if (!match) throw new Error('series was not played')
    const html = renderToStaticMarkup(
      <SeriesWalkthrough s={next} match={match} onFinish={() => {}} onOpenFull={() => {}} />,
    )
    expect(html).toContain('Map veto')
    expect(html).toContain(`Play map 1: ${match.maps[0].map}`)
    expect(html).toContain('0 – 0')
    expect(html).not.toContain('win the series')
  })
})
