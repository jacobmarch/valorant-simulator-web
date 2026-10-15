import { describe, expect, test } from 'bun:test'
import { mapLayouts } from '../src/map-layouts'
import { mapImage } from '../src/map-images'
import { simulateSeries } from '../src/game'
import { type MapReplay, type SeriesReplay } from '../src/round-sim'
import {
  ATTACK_PLANS,
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
        expect(post?.start).toBe(plantAt + 1)
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

  test('after a plant, living attackers stand on the planted site', () => {
    let checked = 0
    for (const { map, sides } of allMaps().slice(0, 16)) {
      for (const round of map.rounds) {
        const plant = round.events.find((event) => event.kind === 'plant')
        if (plant?.kind !== 'plant') continue
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const plantAt = round.events.indexOf(plant)
        const site = mapLayouts[map.map].sites[plant.site]
        const onSite = [site.plant, ...site.post]
        const frame = roundFrame(map.map, round, sides, attackerSide, plantAt + 1)
        expect(frame.spike).toMatchObject({ site: plant.site, state: 'planted' })
        for (const mark of frame.marks) {
          if (!mark.attacking || !mark.alive) continue
          checked++
          expect(onSite.some((point) => point.x === mark.x && point.y === mark.y)).toBe(true)
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
        // Just before the plant: the attackers have gone in and not yet moved on.
        const plantAt = round.events.indexOf(plant)
        // The hit has to have landed before the plant for the attack to be on the site.
        if (plantAt <= roundPlan(map.map, round).hitIndex) continue
        const contact = roundFrame(map.map, round, sides, attackerSide, plantAt)
        const onSite = [...site.entry, ...site.lanes, site.lurk[0]]
        for (const mark of contact.marks) {
          if (!mark.alive) continue
          // Defenders hold the site, fall back to its retake points, sit mid, or hold the other site
          // when the attack pivots onto this one.
          const defending = [
            ...site.holds,
            ...site.retake,
            ...Object.values(mapLayouts[map.map].sites).flatMap((layout) => layout.holds),
            ...mapLayouts[map.map].mid,
          ]
          const at = mark.attacking ? onSite : defending
          expect(at.some((point) => point.x === mark.x && point.y === mark.y)).toBe(true)
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  test('every kill is between opposing sides, in map control early and on the hit site after', () => {
    let early = 0
    let onSiteKills = 0
    for (const { map, sides } of allMaps()) {
      const layout = mapLayouts[map.map]
      for (const round of map.rounds) {
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const plan = roundPlan(map.map, round)
        const hit = layout.sites[plan.hit]
        const siteSpots = [
          ...hit.holds,
          ...hit.entry,
          ...hit.lanes,
          ...hit.post,
          ...hit.retake,
          hit.lurk[0],
        ]
        const controlSpots = [
          ...layout.mid,
          ...layout.flank,
          ...hit.entry,
          ...hit.holds,
          hit.lurk[0],
        ]
        const isOn = (mark: { x: number; y: number }, spots: { x: number; y: number }[]) =>
          spots.some((point) => point.x === mark.x && point.y === mark.y)
        round.events.forEach((event, index) => {
          if (event.kind !== 'kill') return
          const side = (id: string) => (sides.a.includes(id) ? 'a' : 'b')
          expect(side(event.killerId)).not.toBe(side(event.victimId))
          // The frame just after the kill: the fight is where both of them now stand.
          const frame = roundFrame(map.map, round, sides, attackerSide, index + 1)
          const killer = frame.marks.find((mark) => mark.id === event.killerId)
          const victim = frame.marks.find((mark) => mark.id === event.victimId)
          if (!killer || !victim) throw new Error('kill names a player not in the round')
          if (index < plan.hitIndex) {
            early++
            expect(isOn(killer, controlSpots)).toBe(true)
            expect(isOn(victim, controlSpots)).toBe(true)
          } else {
            onSiteKills++
            expect(isOn(killer, siteSpots)).toBe(true)
            expect(isOn(victim, siteSpots)).toBe(true)
          }
        })
      }
    }
    expect(early).toBeGreaterThan(0)
    expect(onSiteKills).toBeGreaterThan(0)
  })

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
        for (const mark of crew)
          expect(home.some((point) => point.x === mark.x && point.y === mark.y)).toBe(true)
      }
    }
    expect(openings).toEqual(new Set(['mid', 'a-main', 'b-main', 'c-main', 'default']))
  })

  test('attackers spread out in contact, with a lurker apart from the group', () => {
    let lurks = 0
    for (const { map, sides } of allMaps()) {
      const layout = mapLayouts[map.map]
      for (const round of map.rounds) {
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const attackers = sides[attackerSide]
        const lurker = pickLurker(attackers, () => 'Duelist')
        expect(lurker).toBe(attackers[attackers.length - 1])
        const plant = round.events.find((event) => event.kind === 'plant')
        const site = plant?.kind === 'plant' ? layout.sites[plant.site] : undefined
        // Contact comes before the plant, so read the frame just before it.
        const plantAt = plant?.kind === 'plant' ? round.events.indexOf(plant) : -1
        if (plantAt <= roundPlan(map.map, round).hitIndex) continue
        const frame = roundFrame(
          map.map,
          round,
          sides,
          attackerSide,
          plantAt === -1 ? 1 : plantAt,
          lurker,
        )
        // Beats where attackers share a spot on purpose are not checked: only the attack's own.
        const spots = new Set(
          frame.marks
            .filter((mark) => mark.attacking && mark.alive)
            .map((mark) => `${mark.x},${mark.y}`),
        )
        // Every living attacker stands on a point of their own.
        const living = frame.marks.filter((mark) => mark.attacking && mark.alive).length
        expect(spots.size).toBe(living)
        const lurking = frame.marks.find((mark) => mark.id === lurker)
        if (site && lurking?.alive && lurking.attacking) {
          lurks++
          // The lurker sits on the lurk spot, or has moved onto the site to take a fight.
          const onSite = [...site.lurk, ...site.entry, ...site.lanes, ...layout.flank, ...site.post]
          expect(onSite.some((point) => point.x === lurking.x && point.y === lurking.y)).toBe(true)
        }
      }
    }
    expect(lurks).toBeGreaterThan(0)
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
        const showing = control.marks.filter(
          (mark) =>
            mark.attacking &&
            fake.entry.slice(0, 2).some((point) => point.x === mark.x && point.y === mark.y),
        )
        expect(showing.length).toBe(2)
        expect(plan.fake).not.toBe(plan.hit)
        fakes++
      }
    }
    expect(fakes).toBeGreaterThan(0)
    expect(plans).toEqual(new Set(ATTACK_PLANS))
  })

  test('the defence rotates: players off the site cross mid, then arrive on the site', () => {
    let rotations = 0
    for (const { map, sides } of allMaps()) {
      const layout = mapLayouts[map.map]
      for (const round of map.rounds) {
        const stages = roundStages(map.map, round)
        const rotate = stages.find((stage) => stage.kind === 'rotate')
        if (!rotate) continue
        const attackerSide = round.attackerId === map.aId ? 'a' : 'b'
        const plan = roundPlan(map.map, round)
        const site = layout.sites[plan.hit]
        const onSite = [...site.holds, ...site.retake]
        const before = roundFrame(map.map, round, sides, attackerSide, rotate.start - 0.25)
        const after = roundFrame(map.map, round, sides, attackerSide, rotate.start)
        for (const mark of after.marks) {
          if (mark.attacking || !mark.alive) continue
          const earlier = before.marks.find((candidate) => candidate.id === mark.id)
          const wasOn = earlier ? onSite.some((p) => p.x === earlier.x && p.y === earlier.y) : false
          // Anyone off the site before the rotation is on it after.
          if (!wasOn && earlier?.alive) {
            rotations++
            expect(onSite.some((p) => p.x === mark.x && p.y === mark.y)).toBe(true)
          }
        }
      }
    }
    expect(rotations).toBeGreaterThan(0)
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
