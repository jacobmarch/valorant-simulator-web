import { beforeEach, describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  createGame,
  playableTournamentFixtureIds,
  simulateSeries,
  simulateTournamentFixture,
} from '../src/game'
import { RoundReplayView } from '../src/round-replay'
import type { SeriesReplay } from '../src/round-sim'
import { SeriesWalkthrough } from '../src/series-walkthrough'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

function watched(seed = 1) {
  const state = createGame('Manager', 'sen')
  state.rng = seed
  const replay: SeriesReplay = { maps: [] }
  const [aId, bId] = Object.keys(state.teams)
  const match = simulateSeries(state, aId, bId, 1, undefined, undefined, 3, undefined, replay)
  return { state, replay, match }
}

describe('round-by-round sim', () => {
  test('the replay matches the box score it produces', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { replay, match } = watched(seed)
      expect(replay.maps.map((map) => map.map)).toEqual(match.maps.map((map) => map.map))
      replay.maps.forEach((mapReplay, index) => {
        const result = match.maps[index]
        const last = mapReplay.rounds[mapReplay.rounds.length - 1]
        expect([last.aScore, last.bScore]).toEqual([result.aScore, result.bScore])
        expect(mapReplay.rounds.map((round) => round.summary)).toEqual(result.rounds)
        const kills: Record<string, number> = {},
          deaths: Record<string, number> = {}
        let plants = 0,
          defuses = 0
        for (const round of mapReplay.rounds) {
          for (const event of round.events) {
            if (event.kind === 'kill') {
              kills[event.killerId] = (kills[event.killerId] ?? 0) + 1
              deaths[event.victimId] = (deaths[event.victimId] ?? 0) + 1
            } else if (event.kind === 'plant') plants++
            else defuses++
          }
        }
        for (const [id, stat] of Object.entries(result.stats)) {
          expect(stat.kills).toBe(kills[id] ?? 0)
          expect(stat.deaths).toBe(deaths[id] ?? 0)
        }
        const statPlants = Object.values(result.stats).reduce((sum, stat) => sum + stat.plants, 0)
        const statDefuses = Object.values(result.stats).reduce((sum, stat) => sum + stat.defuses, 0)
        expect(statPlants).toBe(plants)
        expect(statDefuses).toBe(defuses)
      })
    }
  })

  test('rounds play out in a consistent order', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { state, replay } = watched(seed)
      for (const mapReplay of replay.maps) {
        const lineups = {
          [mapReplay.aId]: state.teams[mapReplay.aId].lineup,
          [mapReplay.bId]: state.teams[mapReplay.bId].lineup,
        }
        for (const round of mapReplay.rounds) {
          const loserId = round.winnerId === mapReplay.aId ? mapReplay.bId : mapReplay.aId
          const dead = new Set<string>()
          let time = 0
          for (const event of round.events) {
            expect(event.time).toBeGreaterThanOrEqual(time)
            time = event.time
            if (event.kind === 'kill') {
              // Dead players neither kill nor die again.
              expect(dead.has(event.killerId)).toBe(false)
              expect(dead.has(event.victimId)).toBe(false)
              dead.add(event.victimId)
            } else {
              expect(dead.has(event.playerId)).toBe(false)
            }
          }
          const winnersAlive = lineups[round.winnerId].filter((id) => !dead.has(id)).length
          const losersAlive = lineups[loserId].filter((id) => !dead.has(id)).length
          expect(winnersAlive).toBeGreaterThan(0)
          const planted = round.events.some((event) => event.kind === 'plant')
          if (round.endReason === 'elimination') expect(losersAlive).toBe(0)
          if (round.endReason === 'detonation') expect(planted).toBe(true)
          if (round.endReason === 'defuse') {
            expect(planted).toBe(true)
            expect(round.events[round.events.length - 1].kind).toBe('defuse')
          }
          if (round.round === 1 || round.round === 13)
            expect(round.buys.map((buy) => buy.buy)).toEqual(['pistol', 'pistol'])
          if (round.overtime) expect(round.buys.map((buy) => buy.buy)).toEqual(['full', 'full'])
        }
      }
    }
  })

  test('watching the series keeps round detail out of the save', () => {
    const state = createGame('Manager', 'sen')
    const fixtureId = playableTournamentFixtureIds(state)[0]
    const replay: SeriesReplay = { maps: [] }
    const next = simulateTournamentFixture(
      state,
      fixtureId,
      'Measured defaults',
      'Disciplined retakes',
      replay,
    )
    const resultId = next.fixtures.find((fixture) => fixture.id === fixtureId)?.resultId
    const match = next.matches.find((candidate) => candidate.id === resultId)
    if (!match) throw new Error('series was not played')
    expect(replay.maps.length).toBe(match.maps.length)
    expect(Object.keys(match).sort()).toEqual(Object.keys(next.matches[1] ?? match).sort())
    const saved = memory.get([...memory.keys()][0]) ?? ''
    expect(saved).toContain(match.id)
    expect(saved).not.toContain('"events"')
    expect(saved).not.toContain('"endReason"')
  })

  test('the walkthrough offers to watch each map round by round', () => {
    const state = createGame('Manager', 'sen')
    const fixtureId = playableTournamentFixtureIds(state)[0]
    const replay: SeriesReplay = { maps: [] }
    const next = simulateTournamentFixture(
      state,
      fixtureId,
      'Measured defaults',
      'Disciplined retakes',
      replay,
    )
    const resultId = next.fixtures.find((fixture) => fixture.id === fixtureId)?.resultId
    const match = next.matches.find((candidate) => candidate.id === resultId)
    if (!match) throw new Error('series was not played')
    const html = renderToStaticMarkup(
      <SeriesWalkthrough
        s={next}
        match={match}
        replay={replay}
        onFinish={() => {}}
        onOpenFull={() => {}}
      />,
    )
    expect(html).toContain(`Watch map 1: ${match.maps[0].map}`)
    expect(html).toContain('Sim map 1')
  })

  test('the replay opens on round 1 without spoiling the result', () => {
    const { state, replay } = watched(3)
    const html = renderToStaticMarkup(
      <RoundReplayView s={state} replay={replay.maps[0]} onDone={() => {}} />,
    )
    expect(html).toContain('Round 1')
    expect(html).toContain('Pistol round.')
    expect(html).toContain('Buy phase')
    expect(html).not.toContain('win the round')
  })
})
