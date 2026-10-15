import { describe, expect, test } from 'bun:test'
import { mapLayouts } from '../src/map-layouts'
import { mapImage } from '../src/map-images'
import { simulateSeries } from '../src/game'
import { type MapReplay, type SeriesReplay } from '../src/round-sim'
import {
  ATTACK_PLANS,
  FIGHT_AT,
  FIGHT_RANGE,
  pickLurker,
  roundFrame,
  roundPlan,
  roundStages,
  stageIndexAt,
  stepAfter,
} from '../src/round-stages'
import { createKickoffGame } from './helpers'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})

function watched(seed: number) {
  const state = createKickoffGame('Manager', 'sen')
  state.rng = seed
  const replay: SeriesReplay = { maps: [] }
  const [aId, bId] = Object.keys(state.teams)
  simulateSeries(state, aId, bId, 1, undefined, undefined, 3, undefined, replay)
  return { state, maps: replay.maps }
}

/** Every map played across seeds 1-8, with the lineups it was played by. */
let cached: ReturnType<typeof computeAllMaps> | undefined
function allMaps() {
  cached ??= computeAllMaps()
  return cached
}
function computeAllMaps() {
  return Array.from({ length: 8 }, (_, index) => watched(index + 1)).flatMap(({ state, maps }) =>
    maps.map((map: MapReplay) => ({
      map,
      sides: { a: state.teams[map.aId].lineup, b: state.teams[map.bId].lineup },
    })),
  )
}

function frames(
  map: MapReplay,
  round: MapReplay['rounds'][number],
  sides: { a: string[]; b: string[] },
  attackerSide: 'a' | 'b',
) {
  return Array.from({ length: round.events.length + 2 }, (_, step) =>
    roundFrame(map.map, round, sides, attackerSide, step),
  )
}

describe('round stages', () => {
  test('every map in the pool has a minimap image and a layout with its sites', () => {
    const pool = ['Abyss', 'Bind', 'Breeze', 'Haven', 'Icebox', 'Lotus', 'Sunset']
    for (const map of pool) {
      const layout = mapLayouts[map]
      expect(mapImage(map)).toBeTruthy()
      expect(layout.siteNames.length).toBeGreaterThanOrEqual(2)
      for (const name of layout.siteNames) {
        const site = layout.sites[name]
        expect(site.holds.length).toBeGreaterThan(0)
        expect(site.post.length).toBeGreaterThan(0)
        expect(site.retake.length).toBeGreaterThan(0)
      }
    }
    expect(mapLayouts.Haven.siteNames).toEqual(['A', 'B', 'C'])
    expect(mapLayouts.Bind.siteNames).toEqual(['A', 'B'])
  })

  test('every round has several beats, starting with setup at step 0', () => {
    for (const { map } of allMaps()) {
      for (const round of map.rounds) {
        const stages = roundStages(map.map, round)
        expect(stages.length).toBeGreaterThanOrEqual(4)
        expect(stages.length).toBeLessThanOrEqual(9)
        expect(stages[0]).toMatchObject({ kind: 'setup', start: 0 })
        const starts = stages.map((stage) => stage.start)
        expect([...starts].sort((x, y) => x - y)).toEqual(starts)
        expect(new Set(starts).size).toBe(starts.length)
        expect(starts[starts.length - 1]).toBeLessThanOrEqual(round.events.length + 1)
      }
    }
  })

  test('a planted round has a post-plant stage that begins at the plant', () => {
    let checked = 0
    for (const { map } of allMaps()) {
      for (const round of map.rounds) {
        const plantAt = round.events.findIndex((event) => event.kind === 'plant')
        const stages = roundStages(map.map, round)
        const post = stages.find((stage) => stage.kind === 'post-plant')
        if (plantAt === -1) {
          expect(post).toBeUndefined()
          continue
        }
        checked++
        expect(post?.start).toBe(plantAt + 0.8)
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  test('stageIndexAt picks the stage a step falls in', () => {
    const stages = [
      { kind: 'setup' as const, label: 'Setup', start: 0 },
      { kind: 'hit' as const, label: 'A hit', start: 1 },
      { kind: 'post-plant' as const, label: 'Post-plant', start: 4 },
    ]
    expect(
      [0, 1, 2, 3, 4, 9, Number.POSITIVE_INFINITY].map((step) => stageIndexAt(stages, step)),
    ).toEqual([0, 1, 1, 1, 2, 2, 2])
  })

  test('setup puts attackers on their spawn and defenders in their holds, with no spike', () => {
    for (const { map, sides } of allMaps().slice(0, 12)) {
      for (const round of map.rounds) {
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const frame = roundFrame(map.map, round, sides, attackerSide, 0)
        expect(frame.spike).toBeNull()
        expect(frame.marks.every((mark) => mark.alive)).toBe(true)
        const layout = mapLayouts[map.map]
        const spawns = layout.attackSpawn
        // Defenders take a formation: holds on the hit site, plus the other site's lurk, or mid.
        const defending = [
          ...layout.siteNames.flatMap((name) => layout.sites[name].holds),
          ...layout.siteNames.map((name) => layout.sites[name].lurk[0]),
          ...layout.mid,
        ]
        for (const mark of frame.marks) {
          const at = mark.attacking ? spawns : defending
          expect(at.some((point) => point.x === mark.x && point.y === mark.y)).toBe(true)
        }
      }
    }
  })

  test('the final frame agrees with the round result', () => {
    for (const { map, sides } of allMaps()) {
      for (const round of map.rounds) {
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const last = roundFrame(map.map, round, sides, attackerSide, round.events.length + 1)
        const victims = new Set(
          round.events.flatMap((event) => (event.kind === 'kill' ? [event.victimId] : [])),
        )
        for (const mark of last.marks) expect(mark.alive).toBe(!victims.has(mark.id))
        const planted = round.events.some((event) => event.kind === 'plant')
        if (round.endReason === 'defuse') expect(last.spike?.state).toBe('defused')
        else if (round.endReason === 'detonation') expect(last.spike?.state).toBe('detonated')
        else expect(last.spike?.state ?? null).toBe(planted ? 'planted' : null)
      }
    }
  })

  test('a dead player stays where they fell for the rest of the round', () => {
    for (const { map, sides } of allMaps().slice(0, 16)) {
      for (const round of map.rounds) {
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const all = frames(map, round, sides, attackerSide)
        round.events.forEach((event, index) => {
          if (event.kind !== 'kill') return
          const fell = all[index + 1].marks.find((mark) => mark.id === event.victimId)
          expect(fell?.alive).toBe(false)
          for (let step = index + 2; step < all.length; step++) {
            const later = all[step].marks.find((mark) => mark.id === event.victimId)
            expect([later?.x, later?.y]).toEqual([fell?.x, fell?.y])
          }
        })
      }
    }
  })

  test('after a plant, living attackers are round the spike', () => {
    let checked = 0
    for (const { map, sides } of allMaps().slice(0, 16)) {
      for (const round of map.rounds) {
        const plant = round.events.find((event) => event.kind === 'plant')
        if (plant?.kind !== 'plant') continue
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const plantAt = round.events.indexOf(plant)
        const site = mapLayouts[map.map].sites[plant.site]
        const frame = roundFrame(map.map, round, sides, attackerSide, plantAt + 1)
        expect(frame.spike).toMatchObject({ site: plant.site, state: 'planted' })
        for (const mark of frame.marks) {
          if (!mark.attacking || !mark.alive) continue
          checked++
          // One walk from wherever they were: close to the spike, never across the map.
          expect(Math.hypot(mark.x - site.plant.x, mark.y - site.plant.y)).toBeLessThan(55)
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  test('frames are a pure function of the round', () => {
    const { map, sides } = allMaps()[0]
    const round = map.rounds[0]
    const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
    const once = roundFrame(map.map, round, sides, attackerSide, round.events.length)
    const again = roundFrame(map.map, round, sides, attackerSide, round.events.length)
    expect(again).toEqual(once)
  })

  test('every player stands on a named point of the map at every step', () => {
    const same = (point: { x: number; y: number }, list: { x: number; y: number }[]) =>
      list.some((candidate) => candidate.x === point.x && candidate.y === point.y)
    let checked = 0
    for (const { map, sides } of allMaps().slice(0, 16)) {
      const layout = mapLayouts[map.map]
      const named = [
        ...layout.attackSpawn,
        ...layout.mid,
        ...layout.flank,
        ...layout.siteNames.flatMap((name) => {
          const site = layout.sites[name]
          return [
            site.plant,
            ...site.entry,
            ...site.lanes,
            ...site.lurk,
            ...site.holds,
            ...site.post,
            ...site.retake,
          ]
        }),
      ]
      for (const round of map.rounds) {
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        for (let step = 0; step <= round.events.length + 1; step++) {
          const frame = roundFrame(map.map, round, sides, attackerSide, step)
          for (const mark of frame.marks) {
            checked++
            expect(same(mark, named)).toBe(true)
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  test('a planted round is played on the planted site', () => {
    let checked = 0
    for (const { map, sides } of allMaps().slice(0, 16)) {
      for (const round of map.rounds) {
        const plant = round.events.find((event) => event.kind === 'plant')
        if (plant?.kind !== 'plant') continue
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const site = mapLayouts[map.map].sites[plant.site]
        const setup = roundFrame(map.map, round, sides, attackerSide, 0)
        const onHold = setup.marks.filter(
          (mark) =>
            !mark.attacking && site.holds.some((point) => point.x === mark.x && point.y === mark.y),
        )
        // A 4-1 setup holds the other site and leaves one defender on the planted site, so the
        // attack pivots onto it. Every setup keeps at least one defender there.
        expect(onHold.length).toBeGreaterThanOrEqual(1)
        checked += onHold.length
        // Just before the plant the attack is on its way to, or on, the planted site.
        const plantAt = round.events.indexOf(plant)
        const before = roundFrame(map.map, round, sides, attackerSide, plantAt)
        for (const mark of before.marks)
          if (mark.attacking && mark.alive)
            expect(Math.hypot(mark.x - site.plant.x, mark.y - site.plant.y)).toBeLessThan(85)
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  test('every kill is between opposing sides, and its fighters meet before the victim dies', () => {
    let kills = 0
    let met = 0
    let early = 0
    for (const { map, sides } of allMaps()) {
      const layout = mapLayouts[map.map]
      for (const round of map.rounds) {
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const plan = roundPlan(map.map, round)
        const hit = layout.sites[plan.hit]
        const ground = [
          ...hit.entry,
          ...hit.lanes,
          ...hit.lurk,
          ...hit.holds,
          ...hit.post,
          ...hit.retake,
          ...layout.mid,
          ...layout.flank,
        ]
        round.events.forEach((event, index) => {
          if (event.kind !== 'kill') return
          const side = (id: string) => (sides.a.includes(id) ? 'a' : 'b')
          expect(side(event.killerId)).not.toBe(side(event.victimId))
          const find = (frame: ReturnType<typeof roundFrame>, id: string) => {
            const mark = frame.marks.find((candidate) => candidate.id === id)
            if (!mark) throw new Error('kill names a player not in the round')
            return mark
          }
          const fight = roundFrame(map.map, round, sides, attackerSide, index + FIGHT_AT)
          const after = roundFrame(map.map, round, sides, attackerSide, index + 1)
          const [killer, victim] = [find(fight, event.killerId), find(fight, event.victimId)]
          // Everyone is alive and in position when the fight shows, and the victim dies in place.
          expect(killer.alive && victim.alive).toBe(true)
          const dead = find(after, event.victimId)
          expect(dead.alive).toBe(false)
          expect([dead.x, dead.y]).toEqual([victim.x, victim.y])
          expect(find(after, event.killerId)).toMatchObject({ x: killer.x, y: killer.y })
          kills++
          if (Math.hypot(killer.x - victim.x, killer.y - victim.y) <= FIGHT_RANGE) met++
          // After the hit the fight is on the site, or on the mid and flanks leading to it.
          if (index >= plan.hitIndex)
            for (const mark of [killer, victim])
              expect(ground.some((point) => point.x === mark.x && point.y === mark.y)).toBe(true)
          else early++
        })
      }
    }
    expect(early).toBeGreaterThan(0)
    // Nearly every fight puts the two players within range of each other.
    expect(met / kills).toBeGreaterThan(0.97)
  }, 30_000)

  test('attacks open in the mid, on a main route, or on their default, and every opening happens', () => {
    const openings = new Set<string>()
    for (const { map, sides } of allMaps()) {
      const layout = mapLayouts[map.map]
      for (const round of map.rounds) {
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const plan = roundPlan(map.map, round)
        openings.add(plan.opening)
        if (plan.attack === 'rush' || plan.attack === 'split') continue
        const lurker = pickLurker(sides[attackerSide], () => 'Duelist')
        const opening = roundFrame(map.map, round, sides, attackerSide, 0.25, lurker)
        const crew = opening.marks.filter((mark) => mark.attacking && mark.id !== lurker)
        const mainSites: Record<string, number> = { 'a-main': 0, 'b-main': 1, 'c-main': 2 }
        const home =
          plan.opening === 'mid'
            ? layout.mid
            : plan.opening in mainSites
              ? (() => {
                  const site = layout.sites[layout.siteNames[mainSites[plan.opening]]]
                  return [...site.entry, site.lanes[0]]
                })()
              : null
        if (!home) continue
        // The opening gets everyone to its area. A walk is one move from spawn, so each attacker
        // is on, or beside, one of its points.
        for (const mark of crew)
          expect(
            Math.min(...home.map((point) => Math.hypot(point.x - mark.x, point.y - mark.y))),
          ).toBeLessThan(26)
      }
    }
    expect(openings).toEqual(new Set(['mid', 'a-main', 'b-main', 'c-main', 'default']))
  })

  test('attackers spread out, with a lurker apart from the group', () => {
    let checked = 0
    for (const { map, sides } of allMaps()) {
      for (const round of map.rounds) {
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const attackers = sides[attackerSide]
        const lurker = pickLurker(attackers, () => 'Duelist')
        expect(lurker).toBe(attackers[attackers.length - 1])
        const stages = roundStages(map.map, round)
        // At every beat no two living attackers share a spot or stand on top of each other.
        for (const stage of stages.slice(1)) {
          const frame = roundFrame(map.map, round, sides, attackerSide, stage.start, lurker)
          const living = frame.marks.filter((mark) => mark.attacking && mark.alive)
          living.forEach((mark, at) => {
            for (const mate of living.slice(at + 1)) {
              checked++
              expect(Math.hypot(mark.x - mate.x, mark.y - mate.y)).toBeGreaterThanOrEqual(6.9)
            }
          })
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  test('nobody jumps: between beats a player only walks to a nearby named point', () => {
    let moves = 0
    for (const { map, sides } of allMaps().slice(0, 16)) {
      for (const round of map.rounds) {
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const stages = roundStages(map.map, round)
        // Beats and events only: the fight steps move fighters together and are checked above.
        const steps = [
          ...new Set([
            ...stages.map((stage) => stage.start),
            ...round.events.map((_, index) => index + 1),
          ]),
        ].sort((x, y) => x - y)
        let before = roundFrame(map.map, round, sides, attackerSide, 0)
        for (const step of steps.slice(1)) {
          const stage = stages.find((candidate) => candidate.start === step)
          const now = roundFrame(map.map, round, sides, attackerSide, step)
          for (const mark of now.marks) {
            const was = before.marks.find((candidate) => candidate.id === mark.id)
            if (!was?.alive) continue
            const walked = Math.hypot(mark.x - was.x, mark.y - was.y)
            moves++
            // A beat moves a player at most one walk. A fight before a kill can bring two players
            // together from further, so a step that carries a kill is not capped.
            const killStep = step % 1 === 0 && round.events[step - 1]?.kind === 'kill'
            if (!killStep)
              expect(walked).toBeLessThanOrEqual(stage?.kind === 'opening' ? 70.1 : 40.1)
          }
          before = now
        }
      }
    }
    expect(moves).toBeGreaterThan(0)
  })

  test('opposing players are never side by side unless they are about to fight', () => {
    let pairs = 0
    let beside = 0
    for (const { map, sides } of allMaps().slice(0, 16)) {
      for (const round of map.rounds) {
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const stages = roundStages(map.map, round)
        for (const stage of stages.slice(1)) {
          const frame = roundFrame(map.map, round, sides, attackerSide, stage.start)
          const next = round.events[Math.floor(stage.start)]
          const fighters = new Set(next?.kind === 'kill' ? [next.killerId, next.victimId] : [])
          for (const one of frame.marks)
            for (const two of frame.marks) {
              if (!one.alive || !two.alive || !one.attacking || two.attacking) continue
              pairs++
              if (fighters.has(one.id) && fighters.has(two.id)) continue
              if (Math.hypot(one.x - two.x, one.y - two.y) < 11.9) beside++
            }
        }
      }
    }
    expect(pairs).toBeGreaterThan(0)
    expect(beside / pairs).toBeLessThan(0.01)
  })

  test('stepAfter walks beats and events in order, never skipping an event', () => {
    for (const { map } of allMaps().slice(0, 8)) {
      for (const round of map.rounds) {
        const stages = roundStages(map.map, round)
        const seen: number[] = []
        for (let step = 0; step <= round.events.length; step = stepAfter(stages, step))
          seen.push(step)
        for (let event = 0; event < round.events.length; event++) expect(seen).toContain(event)
        for (const stage of stages) expect(seen).toContain(stage.start)
      }
    }
  })

  test('every attack plan happens, and each plan moves the attackers in its own way', () => {
    const plans = new Set<string>()
    let fakes = 0
    for (const { map, sides } of allMaps()) {
      const layout = mapLayouts[map.map]
      for (const round of map.rounds) {
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const plan = roundPlan(map.map, round)
        plans.add(plan.attack)
        if (plan.attack !== 'fake') continue
        // A fake shows a pair on the other site during map control.
        const fake = layout.sites[plan.fake]
        const lurker = pickLurker(sides[attackerSide], () => 'Duelist')
        const control = roundFrame(map.map, round, sides, attackerSide, 0.5, lurker)
        const show = Math.min(
          ...control.marks
            .filter((mark) => mark.attacking)
            .map((mark) => Math.hypot(mark.x - fake.entry[0].x, mark.y - fake.entry[0].y)),
        )
        // The pair is on its way to the other site, or already there.
        expect(show).toBeLessThan(45)
        expect(plan.fake).not.toBe(plan.hit)
        fakes++
      }
    }
    expect(fakes).toBeGreaterThan(0)
    expect(plans).toEqual(new Set(ATTACK_PLANS))
  })

  test('the defence rotates: more defenders are on the site after the rotation beat', () => {
    let arrivals = 0
    for (const { map, sides } of allMaps()) {
      const layout = mapLayouts[map.map]
      for (const round of map.rounds) {
        const stages = roundStages(map.map, round)
        const rotate = stages.find((stage) => stage.kind === 'rotate')
        if (!rotate) continue
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const site = layout.sites[roundPlan(map.map, round).hit]
        const onSite = [...site.holds, ...site.retake]
        const count = (step: number) =>
          roundFrame(map.map, round, sides, attackerSide, step).marks.filter(
            (mark) =>
              !mark.attacking &&
              mark.alive &&
              onSite.some((point) => point.x === mark.x && point.y === mark.y),
          ).length
        const before = count(rotate.start - 0.05)
        const after = count(rotate.start)
        expect(after).toBeGreaterThanOrEqual(before)
        arrivals += after - before
      }
    }
    expect(arrivals).toBeGreaterThan(0)
  })

  test('rounds are not copies of each other', () => {
    const signatures = new Set<string>()
    const shapes = new Map<string, number>()
    let rounds = 0
    for (const { map, sides } of allMaps()) {
      for (const round of map.rounds) {
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const stages = roundStages(map.map, round)
        const steps = new Set([
          ...stages.map((stage) => stage.start),
          ...round.events.map((_, index) => index + 1),
        ])
        const walk = [...steps]
          .sort((x, y) => x - y)
          .map((step) =>
            roundFrame(map.map, round, sides, attackerSide, step)
              .marks.map((mark) => `${mark.x},${mark.y},${mark.alive ? 1 : 0}`)
              .join(';'),
          )
        signatures.add(`${map.map}|${walk.join('/')}`)
        const plan = roundPlan(map.map, round)
        const shape = [
          map.map,
          plan.attack,
          plan.opening,
          plan.formation,
          plan.defense,
          plan.hitIndex,
          plan.push,
          plan.reads,
          plan.retake,
          plan.hit,
        ].join('|')
        shapes.set(shape, (shapes.get(shape) ?? 0) + 1)
        rounds++
      }
    }
    // Every round walks its own route, and no one plan shape accounts for more than a few rounds.
    expect(signatures.size / rounds).toBeGreaterThan(0.97)
    expect(Math.max(...shapes.values()) / rounds).toBeLessThan(0.05)
    expect(shapes.size / rounds).toBeGreaterThan(0.6)
  })

  test('the same round in a different match plays out differently', () => {
    const maps = allMaps()
    const first = maps.find((entry) => entry.map.rounds.length > 3)
    if (!first) throw new Error('no map to compare')
    const plansByRound = new Map<string, Set<string>>()
    for (const { map } of maps)
      for (const round of map.rounds) {
        const plan = roundPlan(map.map, round)
        const key = `${map.map}#${round.round}`
        const set = plansByRound.get(key) ?? new Set<string>()
        set.add(`${plan.attack}|${plan.defense}|${plan.opening}|${plan.hitIndex}`)
        plansByRound.set(key, set)
      }
    const repeated = [...plansByRound.values()].filter((set) => set.size > 1)
    expect(repeated.length).toBeGreaterThan(0)
  })

  test('a Sentinel or Controller is picked to lurk over other roles', () => {
    const roles: Record<string, 'Duelist' | 'Sentinel' | 'Controller'> = {
      a: 'Duelist',
      b: 'Controller',
      c: 'Sentinel',
    }
    expect(pickLurker(['a', 'b', 'c'], (id) => roles[id])).toBe('b')
    expect(pickLurker(['a', 'c'], (id) => roles[id])).toBe('c')
    expect(pickLurker(['a'], () => 'Duelist')).toBe('a')
  })
})
