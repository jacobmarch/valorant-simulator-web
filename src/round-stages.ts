// Turns a round's plan (src/round-plan.ts) into positions: where every player stands at any step.
//
// A step is how far the round has played: step n means the first n events have happened, and a
// fractional step is a beat between two events (see Stage). Movement for a beat is applied as the
// round reaches it, and kills are placed where the fight for that phase happens: in map control
// before the hit, and on the hit site after it.
//
// Players only ever stand on named points from the map layout (src/map-layouts.ts). Nothing here
// draws random numbers: the plan is seeded from the round, and the kills, deaths and plant come
// from the events the sim already wrote.
import { layoutFor, type MapLayout, type Point, type SiteLayout } from './map-layouts'
import {
  ATTACK_FORMATIONS,
  ATTACK_OPENINGS,
  ATTACK_PLANS,
  DEFENSE_FORMATIONS,
  THREE_SITE_OPENINGS,
  hitSiteOf,
  roundPlan,
  roundStages,
  stageIndexAt,
  stepAfter,
  type AttackFormation,
  type AttackOpening,
  type AttackPlan,
  type DefenseFormation,
  type RoundPlan,
  type Stage,
  type StageKind,
} from './round-plan'
import type { Role } from './seed'
import type { RoundReplay } from './round-sim'

export {
  ATTACK_FORMATIONS,
  ATTACK_OPENINGS,
  ATTACK_PLANS,
  DEFENSE_FORMATIONS,
  THREE_SITE_OPENINGS,
  hitSiteOf,
  roundPlan,
  roundStages,
  stageIndexAt,
  stepAfter,
}
export type {
  AttackFormation,
  AttackOpening,
  AttackPlan,
  DefenseFormation,
  RoundPlan,
  Stage,
  StageKind,
}

export type Side = 'a' | 'b'
export type Mark = {
  id: string
  side: Side
  attacking: boolean
  x: number
  y: number
  alive: boolean
}
export type Spike = {
  x: number
  y: number
  site: string
  state: 'planted' | 'defused' | 'detonated'
}
export type RoundFrame = { marks: Mark[]; spike: Spike | null }

/**
 * The defenders' setup. `main` of them stand on `mainSite`'s holds, and the rest stand at `off`.
 * - 4-1: four hold the other site, so the attack pivots onto the hit site, where one defender waits.
 * - 2-1-2: two hold the hit site, one sits in mid, two hold the other site.
 * - 3-2: three hold the hit site, two hold the other site.
 */
function defenseSetup(
  formation: DefenseFormation,
  layout: MapLayout,
  hit: string,
  other: string,
): { main: number; mainSite: string; off: Point[] } {
  const hitSite = layout.sites[hit]
  const otherSite = layout.sites[other]
  if (formation === '4-1') return { main: 4, mainSite: other, off: [hitSite.holds[0]] }
  if (formation === '2-1-2')
    return { main: 2, mainSite: hit, off: [layout.mid[0], otherSite.holds[0], otherSite.holds[1]] }
  return { main: 3, mainSite: hit, off: [otherSite.holds[0], otherSite.holds[1]] }
}

/** Whether a player stands on one of these points. */
const standsOn = (mark: { x: number; y: number }, points: Point[]) =>
  points.some((point) => point.x === mark.x && point.y === mark.y)

/** Where the attackers without the lurker scout from, in mid, before the hit. */
const ATTACK_STAGING: Record<AttackFormation, (layout: MapLayout) => Point[]> = {
  '5-0': (layout) => [layout.mid[0], layout.mid[1], layout.mid[2], layout.mid[3]],
  '2-1-2': (layout) => [layout.mid[0], layout.mid[1], layout.mid[3], layout.mid[4]],
  '3-1-1': (layout) => [layout.mid[0], layout.mid[1], layout.mid[2], layout.mid[4]],
}

/** Where the attackers without the lurker go in, in order, once the hit starts. */
const ATTACK_HITS: Record<AttackFormation, (site: SiteLayout) => Point[]> = {
  '5-0': (site) => [...site.entry, site.lanes[0]],
  '2-1-2': (site) => [site.lanes[0], site.lanes[1], site.entry[1], site.entry[0]],
  '3-1-1': (site) => [site.entry[0], site.entry[1], site.entry[2], site.lanes[1]],
}

/**
 * How close a killer has to stand to a victim for the kill to read as a fight. About a site's width:
 * a holder can be this far from an entry point even on the same site.
 */
export const FIGHT_RANGE = 30

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/** The points the attackers, other than the lurker, start from for a plan's opening. */
function openingPoints(plan: RoundPlan, layout: MapLayout): Point[] {
  const site = layout.sites[plan.hit]
  if (plan.attack === 'rush') return [...site.entry, site.lanes[1]]
  if (plan.attack === 'split') return [site.entry[0], site.lanes[1], site.entry[2], site.lanes[0]]
  if (plan.opening === 'mid') return layout.mid.slice(0, 4)
  if (plan.opening === 'default') return ATTACK_STAGING[plan.formation](layout)
  const mainSite =
    layout.sites[layout.siteNames[{ 'a-main': 0, 'b-main': 1, 'c-main': 2 }[plan.opening]]]
  return [...mainSite.entry, mainSite.lanes[0]]
}

/** Where the attackers without the lurker take map control from. */
function controlPoints(plan: RoundPlan, layout: MapLayout): Point[] {
  const site = layout.sites[plan.hit]
  if (plan.attack === 'fake') {
    const fake = layout.sites[plan.fake]
    return [fake.entry[0], fake.entry[1], layout.mid[2], layout.mid[3]]
  }
  if (plan.attack === 'slow') return [site.entry[2], layout.mid[2], site.lanes[1], layout.mid[0]]
  return [layout.mid[1], layout.mid[3], site.lanes[0], layout.mid[2]]
}

/** Where the attackers without the lurker go in for the hit. */
function hitPoints(plan: RoundPlan, site: SiteLayout): Point[] {
  // The pair that faked comes round onto the lanes while the rest take the entries.
  if (plan.attack === 'fake') return [site.lanes[0], site.lanes[1], site.entry[0], site.entry[1]]
  if (plan.attack === 'rush') return ATTACK_HITS['5-0'](site)
  if (plan.attack === 'split') return ATTACK_HITS['2-1-2'](site)
  return ATTACK_HITS[plan.formation](site)
}

/**
 * The attacker who lurks: the first Sentinel or Controller among the attackers, as a team usually
 * sends one to flank. With neither, the last attacker lurks, so one attacker is always apart.
 */
export function pickLurker(attackers: string[], roleOf: (id: string) => Role): string | undefined {
  const flanker = attackers.find((id) => roleOf(id) === 'Sentinel' || roleOf(id) === 'Controller')
  return flanker ?? attackers[attackers.length - 1]
}

type Roster = { id: string; side: Side }

/**
 * Where everyone stands after `step` of a round.
 *
 * - Setup: attackers spawn; defenders take their formation.
 * - Opening and control: the attackers go where their plan has them (mid, a main route, split
 *   across two routes, a pair showing on the other site), and the lurker takes a flank. A pushing
 *   defender may come forward, and kills in this phase fall on the control points.
 * - Read: defenders off the hit site start rotating if they read the attack.
 * - Hit: the attackers commit to the site. Three or more holders fight it; fewer fall off to the
 *   retake while the rest rotate through mid. The rotation arrives partway through the fight.
 * - Post-plant: the attackers set up round the spike and the defenders regroup, then retake.
 * - The planter and the defuser stand beside the spike. Victims stay where they fell.
 */
export function roundFrame(
  map: string,
  round: RoundReplay,
  sides: { a: string[]; b: string[] },
  attackerSide: Side,
  step: number,
  lurkerId?: string,
): RoundFrame {
  const layout: MapLayout = layoutFor(map)
  const stages = roundStages(map, round)
  const plan = roundPlan(map, round)
  const site = layout.sites[plan.hit]
  const other = layout.sites[plan.fake]
  const defense = defenseSetup(plan.defense, layout, plan.hit, plan.fake)
  const mainHolds = layout.sites[defense.mainSite].holds
  const roster: Roster[] = [
    ...sides.a.map((id) => ({ id, side: 'a' as const })),
    ...sides.b.map((id) => ({ id, side: 'b' as const })),
  ]
  const attacking = (player: Roster) => player.side === attackerSide
  const attackers = roster.filter(attacking)
  const defenders = roster.filter((player) => !attacking(player))
  const lurker = attackers.find((player) => player.id === lurkerId)
  const crew = attackers.filter((player) => player !== lurker)
  // Slots: who stands on which point of a list. They come from the plan's shuffle, and stay with a
  // player for the whole round, living or dead.
  const slots = new Map<string, number>()
  const ranked = (order: number[], group: Roster[]) => order.filter((rank) => rank < group.length)
  ranked(plan.attackOrder, crew).forEach((rank, at) => slots.set(crew[at].id, rank))
  ranked(plan.defenseOrder, defenders).forEach((rank, at) => slots.set(defenders[at].id, rank))
  const slotOf = (player: Roster) => slots.get(player.id) ?? 0
  const pointAt = (points: Point[], player: Roster) => points[slotOf(player) % points.length]

  const pos: Record<string, Mark> = {}
  const place = (player: Roster, at: Point) => {
    pos[player.id] = {
      id: player.id,
      side: player.side,
      attacking: attacking(player),
      x: at.x,
      y: at.y,
      alive: pos[player.id]?.alive ?? true,
    }
  }
  const alive = (group: Roster[]) => group.filter((player) => pos[player.id]?.alive !== false)
  // A spot nobody living is on, so two players never share one.
  const taken = (spot: Point, self: string) =>
    Object.values(pos).some(
      (mark) => mark.alive && mark.id !== self && mark.x === spot.x && mark.y === spot.y,
    )
  const freeOf = (spots: Point[], self: string) =>
    spots.find((spot) => !taken(spot, self)) ?? spots[0]

  attackers.forEach((player, at) =>
    place(player, layout.attackSpawn[at % layout.attackSpawn.length]),
  )
  defenders.forEach((player) => {
    const slot = slotOf(player)
    place(
      player,
      slot < defense.main
        ? mainHolds[slot]
        : defense.off[(slot - defense.main) % defense.off.length],
    )
  })

  let spike: Spike | null = null
  // Set when the hit lands with fewer than three holders: the defence plays a retake instead.
  let fallen = false
  const onSite = (mark: Mark) => standsOn(mark, site.holds) || standsOn(mark, site.retake)
  const applyBeat = (stage: Stage) => {
    if (stage.kind === 'opening') {
      const points = openingPoints(plan, layout)
      alive(crew).forEach((player) => place(player, pointAt(points, player)))
      if (lurker && alive([lurker]).length) place(lurker, layout.flank[plan.flank])
      // A pushing defender comes forward for information. The last slot is always one that
      // is off the main hold, so the site is never left empty.
      if (plan.push) {
        const pusher = defenders.find((player) => slotOf(player) === 4)
        if (pusher && alive([pusher]).length)
          place(pusher, freeOf([layout.mid[1], layout.mid[3]], pusher.id))
      }
    } else if (stage.kind === 'control') {
      const points = controlPoints(plan, layout)
      alive(crew).forEach((player) => place(player, pointAt(points, player)))
      if (lurker && alive([lurker]).length)
        place(lurker, plan.lurkEarly ? site.lurk[0] : layout.flank[1 - plan.flank])
    } else if (stage.kind === 'read') {
      // Defenders off the hit site see the attack coming and start rotating through mid.
      if (plan.reads)
        alive(defenders)
          .filter((player) => !onSite(pos[player.id]) && !standsOn(pos[player.id], layout.mid))
          .forEach((player) => place(player, freeOf(layout.mid, player.id)))
    } else if (stage.kind === 'hit') {
      const points = hitPoints(plan, site)
      alive(crew).forEach((player) => place(player, pointAt(points, player)))
      if (lurker && alive([lurker]).length) place(lurker, site.lurk[0])
      // The defence answers. Three or more holding the site fight it while the rest rotate in;
      // fewer fall off to the retake points, and the rest of the team plays the retake.
      const holding = alive(defenders).filter((player) => standsOn(pos[player.id], site.holds))
      fallen = holding.length < 3
      if (fallen) holding.forEach((player) => place(player, freeOf(site.retake, player.id)))
      alive(defenders)
        .filter((player) => !onSite(pos[player.id]) && !standsOn(pos[player.id], layout.mid))
        .forEach((player) => place(player, freeOf(layout.mid, player.id)))
    } else if (stage.kind === 'rotate') {
      const arrival = fallen ? site.retake : site.holds
      alive(defenders)
        .filter((player) => !onSite(pos[player.id]))
        .forEach((player) => place(player, freeOf(arrival, player.id)))
    } else if (stage.kind === 'post-plant') {
      alive(crew).forEach((player) => place(player, pointAt(site.post, player)))
      if (lurker && alive([lurker]).length) place(lurker, site.post[site.post.length - 1])
      // The defence regroups before the retake: stacked in mid, or spread round the map.
      const regroup =
        plan.retake === 'tight'
          ? [layout.mid[1], layout.mid[2]]
          : [other.holds[0], layout.mid[0], layout.mid[3], other.holds[1], layout.mid[4]]
      alive(defenders).forEach((player) => place(player, pointAt(regroup, player)))
    } else if (stage.kind === 'retake') {
      const retake = plan.retake === 'tight' ? site.retake.slice(0, 2) : site.retake
      alive(defenders).forEach((player) => place(player, pointAt(retake, player)))
    }
  }

  const attackSpots = [...site.entry, ...site.lanes, site.lurk[0]]
  const defenseSpots = [...site.holds, ...site.retake]
  // Where a fight happens. Before the hit it is on the control points, or at the lurker's flank
  // when the lurker is in it; from the hit on it is on the site.
  const spotsFor = (mark: Mark, index: number, lurkFight: boolean) => {
    const planted = spike !== null
    if (index < plan.hitIndex) {
      if (lurkFight)
        return mark.attacking
          ? [layout.flank[plan.flank], layout.flank[1 - plan.flank], site.lurk[0]]
          : site.holds.slice(-2)
      return mark.attacking ? [...layout.mid, ...layout.flank] : [...layout.mid, ...site.entry]
    }
    if (mark.attacking) return planted ? [...attackSpots, ...site.post] : attackSpots
    return planted ? [...defenseSpots, ...site.retake] : defenseSpots
  }

  const shown = Math.min(Math.floor(step), round.events.length)
  const beats = stages.filter((stage) => stage.start > 0)
  let applied = 0
  // Apply every beat that has started by `limit`, in order.
  const catchUp = (limit: number) => {
    while (applied < beats.length && beats[applied].start <= limit) applyBeat(beats[applied++])
  }
  for (let index = 0; index < shown; index++) {
    catchUp(index + 1)
    const event = round.events[index]
    if (event.kind === 'kill') {
      const victim = pos[event.victimId]
      const killer = pos[event.killerId]
      if (victim?.alive && killer?.alive) {
        const lurkFight = event.killerId === lurkerId || event.victimId === lurkerId
        // Puts a player on the fight's spots if they are not already on them, and in range of the
        // other player in the fight. The victim settles first, then the killer closes in on them.
        const settle = (id: string, otherId: string) => {
          const mark = pos[id]
          const opponent = pos[otherId]
          const spots = spotsFor(mark, index, lurkFight)
          if (standsOn(mark, spots) && distance(mark, opponent) <= FIGHT_RANGE) return
          const free = spots.filter((spot) => !taken(spot, id))
          const pool = free.length > 0 ? free : spots
          const nearest = pool.reduce((best, spot) =>
            distance(spot, opponent) < distance(best, opponent) ? spot : best,
          )
          place({ id, side: mark.side }, nearest)
        }
        settle(event.victimId, event.killerId)
        settle(event.killerId, event.victimId)
      }
      // Read the victim again: settling may have replaced their mark.
      const down = pos[event.victimId]
      if (down) down.alive = false
    } else if (event.kind === 'plant') {
      const planted = layout.sites[event.site]
      const planter = pos[event.playerId]
      // The planter kneels beside the spike, so the spike stays visible.
      if (planter?.alive && planted)
        place({ id: event.playerId, side: planter.side }, planted.post[0])
      if (planted)
        spike = { x: planted.plant.x, y: planted.plant.y, site: event.site, state: 'planted' }
    } else if (spike !== null) {
      const live: Spike = spike
      const defuser = pos[event.playerId]
      if (defuser?.alive) {
        place({ id: event.playerId, side: defuser.side }, layout.sites[live.site].post[0])
      }
      spike = { ...live, state: 'defused' }
    }
  }
  catchUp(step)
  const finalSpike = spike as Spike | null
  if (finalSpike && step > round.events.length && round.endReason === 'detonation')
    spike = { ...finalSpike, state: 'detonated' }
  return { marks: roster.map((player) => pos[player.id]), spike }
}
