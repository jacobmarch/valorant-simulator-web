import { beforeEach, describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  playableTournamentFixtureIds,
  simulateSeries,
  simulateTournamentFixture,
} from '../src/game'
import { RoundReplayView, stripRounds } from '../src/round-replay'
import { aggressionFor, chooseBuy, OVERTIME_CREDITS, type SeriesReplay } from '../src/round-sim'
import { SeriesWalkthrough } from '../src/series-walkthrough'
import { createKickoffGame } from './helpers'

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
  const state = createKickoffGame('Manager', 'sen')
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
    const state = createKickoffGame('Manager', 'sen')
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
    const state = createKickoffGame('Manager', 'sen')
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

  test('the round strip only adds overtime in pairs after a 12-12 tie', () => {
    const round = (aScore: number, bScore: number) => ({ aScore, bScore }) as never
    const regulation = { map: 'Ascent', aId: 'a', bId: 'b', rounds: [] as never[] }
    for (let at = 1; at <= 24; at++)
      regulation.rounds.push(round(Math.min(at, 13), at - 13 > 0 ? at - 13 : 0))
    regulation.rounds[23] = round(13, 11)
    expect(stripRounds(regulation, 24)).toBe(24)
    const overtime = { ...regulation, rounds: [...regulation.rounds] }
    overtime.rounds[23] = round(12, 12)
    expect(stripRounds(overtime, 23)).toBe(24)
    expect(stripRounds(overtime, 24)).toBe(26)
    overtime.rounds.push(round(13, 12), round(13, 13))
    expect(stripRounds(overtime, 25)).toBe(26)
    expect(stripRounds(overtime, 26)).toBe(28)
    overtime.rounds.push(round(14, 13), round(15, 13))
    expect(stripRounds(overtime, 28)).toBe(28)
  })

  test('every overtime round starts both teams on 5,000 credits', () => {
    let overtimeRounds = 0
    for (let seed = 1; seed <= 400 && overtimeRounds < 6; seed++) {
      const { replay } = watched(seed)
      for (const mapReplay of replay.maps)
        for (const round of mapReplay.rounds) {
          if (!round.overtime) continue
          overtimeRounds++
          expect(round.buys.map((buy) => buy.credits)).toEqual([OVERTIME_CREDITS, OVERTIME_CREDITS])
          expect(round.buys.map((buy) => buy.buy)).toEqual(['full', 'full'])
        }
    }
    expect(overtimeRounds).toBeGreaterThan(0)
  })
})

describe('buy decisions', () => {
  const level = { own: 0, opp: 0 }
  const bank = (credits: number, lossStreak = 0) => ({ credits, lossStreak })

  test('a team that loses pistol saves instead of forcing', () => {
    expect(chooseBuy(bank(2100, 1), 2, level).buy).toBe('eco')
    expect(chooseBuy(bank(2100, 1), 14, { own: 0, opp: 12 }).buy).toBe('force')
    expect(chooseBuy(bank(2100, 1), 14, { own: 12, opp: 3 }).buy).toBe('eco')
  })

  test('a lost pistol still full buys with a full bank', () => {
    expect(chooseBuy(bank(3900, 1), 2, level).buy).toBe('full')
  })

  test('half buy or better forces when there is no losing streak', () => {
    const buy = chooseBuy(bank(2000, 0), 5, level)
    expect(buy.buy).toBe('force')
    expect(buy.spend).toBeLessThanOrEqual(2600)
  })

  test('two or more losses in a row save for a full buy', () => {
    expect(chooseBuy(bank(2500, 2), 6, level).buy).toBe('eco')
    expect(chooseBuy(bank(2500, 3), 9, level).buy).toBe('eco')
  })

  test('on the brink of losing the map, a team spends what it has', () => {
    const brink = chooseBuy(bank(1600, 2), 20, { own: 8, opp: 11 })
    expect(brink.buy).toBe('force')
    expect(brink.spend).toBe(1600)
    expect(chooseBuy(bank(1000, 2), 20, { own: 8, opp: 11 }).buy).toBe('eco')
  })

  test('low bank with no brink is eco', () => {
    expect(chooseBuy(bank(900, 0), 4, level).buy).toBe('eco')
  })

  test('pistols and overtime are unchanged', () => {
    expect(chooseBuy(bank(800, 0), 1, level).buy).toBe('pistol')
    expect(chooseBuy(bank(800, 0), 13, level).buy).toBe('pistol')
    expect(chooseBuy(bank(5000, 4), 25, level).buy).toBe('full')
  })

  test('watched maps never force on the round after a lost pistol unless on the brink', () => {
    let checked = 0
    for (let seed = 1; seed <= 12; seed++) {
      const { replay } = watched(seed)
      for (const map of replay.maps)
        for (const index of [1, 13]) {
          const pistol = map.rounds[index - 1],
            round = map.rounds[index]
          if (!pistol || !round) continue
          const loserIsA = pistol.winnerId !== map.aId
          const loserBuy = loserIsA ? round.buys[0] : round.buys[1]
          const opp = loserIsA ? pistol.bScore : pistol.aScore
          checked++
          if (opp < 11) expect(loserBuy.buy).not.toBe('force')
        }
    }
    expect(checked).toBeGreaterThan(0)
  })
})

describe('strategy and round endings', () => {
  // Share of the manager's non-pistol rounds spent forcing, over several watched series.
  function forceShare(attackStyle: string, defenseStyle: string) {
    let forces = 0,
      played = 0
    for (let seed = 1; seed <= 12; seed++) {
      const state = createKickoffGame('Manager', 'sen')
      state.rng = seed
      const replay: SeriesReplay = { maps: [] }
      simulateSeries(
        state,
        'sen',
        Object.keys(state.teams)[5],
        1,
        attackStyle,
        defenseStyle,
        3,
        undefined,
        replay,
      )
      for (const map of replay.maps)
        for (const round of map.rounds) {
          if (round.round === 1 || round.round === 13 || round.overtime) continue
          played++
          if (round.buys[0].buy === 'force') forces++
        }
    }
    return forces / played
  }

  test('a more aggressive strategy forces a larger share of rounds', () => {
    const aggressive = forceShare('Fast and explosive', 'Proactive contesting')
    const conservative = forceShare('Slow information play', 'Deep site anchors')
    expect(aggressive).toBeGreaterThan(conservative)
  })

  test('the attack and defense dropdowns set the aggression level', () => {
    expect(aggressionFor('Fast and explosive', 'Proactive contesting')).toBe('aggressive')
    expect(aggressionFor('Measured defaults', 'Disciplined retakes')).toBe('balanced')
    expect(aggressionFor('Slow information play', 'Deep site anchors')).toBe('conservative')
  })

  test('aggressive teams force through a loss, conservative teams save', () => {
    const lostOnce = { credits: 2400, lossStreak: 1 }
    expect(chooseBuy(lostOnce, 6, { own: 4, opp: 4 }, 'aggressive').buy).toBe('force')
    expect(chooseBuy(lostOnce, 6, { own: 4, opp: 4 }, 'conservative').buy).toBe('eco')
  })

  test('a round that must be played out is never a save', () => {
    const level = { own: 3, opp: 5 }
    // End of a half: the economy resets next, so saving buys nothing.
    expect(chooseBuy({ credits: 1200, lossStreak: 2 }, 12, level).spend).toBe(1200)
    expect(chooseBuy({ credits: 1200, lossStreak: 2 }, 24, level).spend).toBe(1200)
    // Losing would put the opponent at match point, so an aggressive team plays it out.
    const aggressive = chooseBuy(
      { credits: 1200, lossStreak: 2 },
      9,
      { own: 5, opp: 10 },
      'aggressive',
    )
    expect(aggressive.spend).toBe(1200)
    // A conservative team at the same score still saves.
    const conservative = chooseBuy(
      { credits: 1200, lossStreak: 2 },
      9,
      { own: 5, opp: 10 },
      'conservative',
    )
    expect(conservative.spend).toBe(400)
  })

  test('aggressive teams go all in earlier than conservative ones', () => {
    const bank = { credits: 1600, lossStreak: 0 }
    expect(chooseBuy(bank, 9, { own: 5, opp: 10 }, 'aggressive').buy).toBe('force')
    expect(chooseBuy(bank, 9, { own: 5, opp: 10 }, 'conservative').buy).toBe('eco')
    expect(chooseBuy(bank, 9, { own: 5, opp: 12 }, 'conservative').buy).toBe('force')
  })

  test('no watched round ends on the clock', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const state = createKickoffGame('Manager', 'sen')
      state.rng = seed
      const replay: SeriesReplay = { maps: [] }
      simulateSeries(
        state,
        'sen',
        Object.keys(state.teams)[5],
        1,
        undefined,
        undefined,
        3,
        undefined,
        replay,
      )
      for (const map of replay.maps)
        for (const round of map.rounds) {
          expect(['elimination', 'detonation', 'defuse']).toContain(round.endReason)
          const attackerWon = round.winnerId === round.attackerId
          if (!attackerWon && round.endReason !== 'defuse')
            expect(round.endReason).toBe('elimination')
        }
    }
  })
})
