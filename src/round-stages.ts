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
  FIGHT_AT,
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
  FIGHT_AT,
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
 * The defenders' setup: five points, one per slot. The formation counts the players in each lane
 * from left to right: the left site, mid, the right site (flipped when the plan says so). On a
 * three-site map the lanes are the C, B and A sites, so no site is ever left open. The last slot
 * is a mid player, who is the one that pushes.
 */
function defenseSetup(formation: DefenseFormation, layout: MapLayout, flip: boolean): Point[] {
  const counts = formation.split('-').map(Number)
  if (flip) counts.reverse()
  const [left, middle, right] = counts
  // Site letters run right to left, so the left-most site is the last one.
  const sites = [...layout.siteNames].reverse()
  const holds = (name: string, count: number) => layout.sites[name].holds.slice(0, count)
  if (sites.length >= 3)
    return [
      ...holds(sites[0], left),
      ...holds(sites[sites.length - 1], right),
      ...holds(sites[1], middle),
    ]
  return [
    ...holds(sites[0], left),
    ...holds(sites[1], right),
    ...[layout.mid[1], layout.mid[3]].slice(0, middle),
    ...(middle > 2 ? [layout.mid[2]] : []),
  ]
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

/** How close an attacker has to be to a site for the defence to see the attack on it. */
const SEE_RANGE = 40
/** Closest an enemy can stand to a player who is not in a fight with them. */
const ENEMY_GAP = 12
/** Closest two teammates can stand, so two dots are never drawn on top of each other. */
const TEAM_GAP = 7
/** The most a player walks in one beat, from named point to named point. */
const MOVE_LIMIT = 40
/** How close a walk may pass an enemy. Nobody walks through a lane an enemy is standing in. */
const PASS_GAP = 9
/** How far from the spike a defender can be when it goes down: a plant needs the site cleared. */
const PLANT_CLEAR = 28
/** The first beat leaves the spawn, which is further from everything. */
const OPENING_LIMIT = 70

/** Every point of a map, as the places a player can pass through or stand on. */
function walkable(layout: MapLayout): Point[] {
  return [
    ...layout.mid,
    ...layout.flank,
    ...layout.siteNames.flatMap((name) => {
      const site = layout.sites[name]
      return [
        ...site.entry,
        ...site.lanes,
        ...site.lurk,
        ...site.holds,
        ...site.post,
        ...site.retake,
      ]
    }),
  ]
}

/** Best way to hand `goals` out to `players`: the one with the least walking in total. */
function assignGoals<T extends { x: number; y: number }>(
  players: T[],
  goals: Point[],
): Map<T, Point> {
  const count = players.length
  const targets = Array.from({ length: count }, (_, at) => goals[at % goals.length])
  const best = { cost: Number.POSITIVE_INFINITY, order: [] as number[] }
  const order: number[] = []
  const used = new Set<number>()
  const search = (at: number, cost: number) => {
    if (cost >= best.cost) return
    if (at === count) {
      best.cost = cost
      best.order = [...order]
      return
    }
    for (let goal = 0; goal < count; goal++) {
      if (used.has(goal)) continue
      used.add(goal)
      order.push(goal)
      search(at + 1, cost + distance(players[at], targets[goal]))
      order.pop()
      used.delete(goal)
    }
  }
  search(0, 0)
  return new Map(players.map((player, at) => [player, targets[best.order[at]]]))
}

/**
 * Where everyone stands after `step` of a round.
 *
 * Nobody jumps. Setup puts everyone on their formation, and after that a player only walks:
 * each beat gives a side goals, and every player moves toward theirs along the named points, at
 * most `MOVE_LIMIT` a beat, taking whichever walkable point gets them closest. A long trip, like a
 * rotation from one site to the other, takes several beats and passes through mid.
 *
 * - Opening and control: the attackers go where their plan has them (mid, a main route, split
 *   across two routes, a pair showing on the other site), and the lurker takes a flank.
 * - Read: defenders off the hit site start rotating if they read the attack.
 * - Hit: the attackers commit to the site. Three or more holders fight it; fewer fall off to the
 *   retake. Defenders off the site keep rotating, and arrive partway through the fight.
 * - Post-plant: the attackers set up round the spike and the defenders regroup, then retake.
 * - Fights: for a kill, the step before it (`FIGHT_AT`) moves the two fighters together, alive.
 *   The kill itself marks the victim dead where they stand. Anyone else keeps their distance from
 *   an enemy, so two opposing players are never side by side without a fight.
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
  const setup = defenseSetup(plan.defense, layout, plan.flip)
  const roster: Roster[] = [
    ...sides.a.map((id) => ({ id, side: 'a' as const })),
    ...sides.b.map((id) => ({ id, side: 'b' as const })),
  ]
  const attacking = (player: Roster) => player.side === attackerSide
  const attackers = roster.filter(attacking)
  const defenders = roster.filter((player) => !attacking(player))
  const lurker = attackers.find((player) => player.id === lurkerId)
  const crew = attackers.filter((player) => player !== lurker)
  // Slots only decide who starts where on the defence's formation.
  const slots = new Map<string, number>()
  const ranks = plan.defenseOrder.filter((rank) => rank < defenders.length)
  defenders.forEach((player, at) => slots.set(player.id, ranks[at]))
  const slotOf = (player: Roster) => slots.get(player.id) ?? 0

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
  const roads = walkable(layout)

  // The two players whose fight is next. They may stand beside each other; nobody else may.
  let fighting = new Set<string>()
  // Whether a player may stand on `spot`: not on or beside a teammate, and not beside an enemy
  // unless the two are about to fight.
  const free = (spot: Point, who: Roster) =>
    !Object.values(pos).some((mark) => {
      if (!mark.alive || mark.id === who.id) return false
      const apart = distance(mark, spot)
      if (mark.side === who.side) return apart < TEAM_GAP
      return apart < ENEMY_GAP && !(fighting.has(mark.id) && fighting.has(who.id))
    })
  /** Whether walking from one point to another goes past an enemy, who blocks the lane. */
  const blocked = (from: Point, to: Point, who: Roster) =>
    Object.values(pos).some((mark) => {
      if (!mark.alive || mark.side === who.side) return false
      if (fighting.has(mark.id) && fighting.has(who.id)) return false
      const dx = to.x - from.x
      const dy = to.y - from.y
      const length = dx * dx + dy * dy
      const along =
        length === 0
          ? 0
          : Math.max(0, Math.min(1, ((mark.x - from.x) * dx + (mark.y - from.y) * dy) / length))
      return Math.hypot(mark.x - (from.x + dx * along), mark.y - (from.y + dy * along)) < PASS_GAP
    })
  /** One walk toward a goal: the open walkable point within `limit` that gets closest to it. */
  const advance = (player: Roster, goal: Point, limit = MOVE_LIMIT) => {
    const here = pos[player.id]
    let best: Point | undefined
    let bestGap = distance(here, goal)
    for (const road of [goal, ...roads]) {
      if (distance(road, here) > limit || !free(road, player) || blocked(here, road, player))
        continue
      const gap = distance(road, goal)
      if (gap < bestGap - 0.01) {
        best = road
        bestGap = gap
      }
    }
    if (best) place(player, best)
  }
  /** A side's walk: goals handed out for the least walking, then each player takes a step. */
  const march = (group: Roster[], goals: Point[], limit = MOVE_LIMIT) => {
    if (group.length === 0) return
    const targets = assignGoals(
      group.map((player) => ({ player, x: pos[player.id].x, y: pos[player.id].y })),
      goals,
    )
    // Players nearest their goal go first, so a player already in place keeps their spot.
    const order = [...targets.entries()].sort(
      ([a, ga], [b, gb]) => distance(a, ga) - distance(b, gb),
    )
    for (const [{ player }, goal] of order) advance(player, goal, limit)
  }
  const gather = (group: Roster[], goals: Point[], limit?: number) =>
    march(alive(group), goals, limit)

  attackers.forEach((player, at) =>
    place(player, layout.attackSpawn[at % layout.attackSpawn.length]),
  )
  defenders.forEach((player) => {
    place(player, setup[slotOf(player) % setup.length])
  })

  let spike: Spike | null = null
  // Set when the hit lands with fewer than three holders: the defence plays a retake instead.
  let fallen = false
  const onSite = (mark: Mark, target: SiteLayout = site) =>
    standsOn(mark, target.holds) || standsOn(mark, target.retake)
  /** Defenders not on a site, who are on their way to it. */
  const rotators = (target: SiteLayout = site) =>
    alive(defenders).filter((player) => !onSite(pos[player.id], target))
  /** Where rotators head: the holds nobody is on, or the retake points after a fall-off. */
  const arrival = (target: SiteLayout = site, retake = fallen) => {
    const spots = retake ? target.retake : target.holds
    const open = spots.filter(
      (spot) => !alive(defenders).some((player) => standsOn(pos[player.id], [spot])),
    )
    return open.length > 0 ? open : spots
  }
  /**
   * The site the defence sees the attack on: where most attackers are within sight of it. The
   * defence only reacts to what it sees, so attackers in mid or on a flank show nothing yet.
   */
  const seenSite = (): SiteLayout | undefined => {
    let best: SiteLayout | undefined
    let most = 0
    for (const name of layout.siteNames) {
      const target = layout.sites[name]
      const seen = alive(attackers).filter(
        (player) => distance(pos[player.id], target.plant) < SEE_RANGE,
      ).length
      if (seen > most) {
        best = target
        most = seen
      }
    }
    return best
  }
  const applyBeat = (stage: Stage) => {
    if (stage.kind === 'opening') {
      gather(crew, openingPoints(plan, layout), OPENING_LIMIT)
      if (lurker) gather([lurker], [layout.flank[plan.flank]], OPENING_LIMIT)
      // A pushing defender comes forward for information. Slot 4 is always off the main hold, so
      // the site is never left empty.
      const pusher = defenders.find((player) => slotOf(player) === 4)
      if (plan.push && pusher) gather([pusher], [layout.mid[1], layout.mid[3]])
    } else if (stage.kind === 'control') {
      gather(crew, controlPoints(plan, layout))
      if (lurker) gather([lurker], plan.lurkEarly ? [site.lurk[0]] : [layout.flank[plan.flank]])
    } else if (stage.kind === 'read') {
      // The defence reacts to where it sees the attack. A defence that reads a fake holds its sites
      // and only sends mid players toward the real one; one that does not rotates to the show.
      const seen = seenSite()
      if (seen) {
        const fake = plan.attack === 'fake' && seen !== site
        if (fake && plan.reads)
          gather(
            alive(defenders).filter((player) => standsOn(pos[player.id], layout.mid)),
            arrival(site, false),
          )
        else if (!fake ? plan.reads : true) gather(rotators(seen), arrival(seen, false))
      }
    } else if (stage.kind === 'hit') {
      gather(crew, hitPoints(plan, site))
      if (lurker) gather([lurker], [site.lurk[0]])
      // The defence answers. Three or more holding the site fight it while the rest rotate in;
      // fewer fall off to the retake points, and the rest of the team plays the retake.
      const holding = alive(defenders).filter((player) => standsOn(pos[player.id], site.holds))
      fallen = holding.length < 3
      if (fallen) gather(holding, site.retake)
      gather(rotators(), arrival())
    } else if (stage.kind === 'rotate') {
      // Everyone still walking in arrives: the defenders rotating, and the attackers who faked.
      gather(rotators(), arrival())
      gather(crew, hitPoints(plan, site))
    } else if (stage.kind === 'post-plant') {
      // The plant needs the site cleared: any defender still near the spike has been pushed off it.
      const regroupGoals =
        plan.retake === 'tight'
          ? [layout.mid[1], layout.mid[2]]
          : [other.holds[0], layout.mid[0], layout.mid[3], other.holds[1], layout.mid[4]]
      const near = alive(defenders).filter(
        (player) => distance(pos[player.id], site.plant) < PLANT_CLEAR,
      )
      for (const player of near) {
        const here = pos[player.id]
        // Off the site by the nearest way out that does not cross an enemy, or any way out.
        const exits = roads
          .filter((road) => distance(road, site.plant) >= PLANT_CLEAR && free(road, player))
          .sort((a, b) => distance(a, here) - distance(b, here))
        const out = exits.find((road) => !blocked(here, road, player)) ?? exits[0]
        if (out) place(player, out)
      }
      gather(crew, site.post)
      if (lurker) gather([lurker], [site.post[site.post.length - 1]])
      // The defence regroups before the retake: stacked in mid, or spread round the map.
      gather(
        defenders.filter((player) => !near.includes(player)),
        regroupGoals,
      )
    } else if (stage.kind === 'retake') {
      gather(defenders, plan.retake === 'tight' ? site.retake.slice(0, 2) : site.retake)
    }
  }

  // Where a fight can happen. Before the hit it can be anywhere on the map. From the hit on it is
  // on the hit site, or on mid and the flanks leading to it.
  const siteGround = [
    ...site.entry,
    ...site.lanes,
    ...site.lurk,
    ...site.holds,
    ...site.post,
    ...site.retake,
    ...layout.mid,
    ...layout.flank,
  ]
  const fightGround = (index: number) => (index < plan.hitIndex ? roads : siteGround)
  /**
   * Brings two players into a fight: the pair of points within `FIGHT_RANGE` of each other that
   * takes the least walking, so players who are already close barely move.
   */
  const meet = (index: number, killerId: string, victimId: string) => {
    const killer = pos[killerId]
    const victim = pos[victimId]
    if (!killer?.alive || !victim?.alive) return
    const ground = fightGround(index)
    if (
      standsOn(killer, ground) &&
      standsOn(victim, ground) &&
      distance(killer, victim) <= FIGHT_RANGE
    )
      return
    const who = (id: string) => roster.find((player) => player.id === id) as Roster
    const [killerWho, victimWho] = [who(killerId), who(victimId)]
    let best: { a: Point; b: Point } | undefined
    let bestCost = Number.POSITIVE_INFINITY
    // Prefer a meeting that does not take either fighter through an enemy's lane.
    for (const clear of [true, false]) {
      for (const a of ground) {
        if (!free(a, killerWho) || (clear && blocked(killer, a, killerWho))) continue
        for (const b of ground) {
          if (distance(a, b) > FIGHT_RANGE || (a.x === b.x && a.y === b.y) || !free(b, victimWho))
            continue
          if (clear && blocked(victim, b, victimWho)) continue
          const cost = distance(killer, a) + distance(victim, b)
          if (cost < bestCost) {
            best = { a, b }
            bestCost = cost
          }
        }
      }
      if (best) break
    }
    if (best) {
      place(killerWho, best.a)
      place(victimWho, best.b)
    }
  }

  const events = round.events
  const beats = stages.filter((stage) => stage.start > 0)
  let applied = 0
  // Apply every beat that has started by `limit`, in order.
  const catchUp = (limit: number) => {
    while (applied < beats.length && beats[applied].start <= limit) applyBeat(beats[applied++])
  }
  /** The next event's fighters, who may close in on each other before it. */
  const expecting = (index: number) => {
    const event = events[index]
    fighting = new Set(event?.kind === 'kill' ? [event.killerId, event.victimId] : [])
  }
  const shown = Math.min(Math.floor(step), events.length)
  for (let index = 0; index < shown; index++) {
    expecting(index)
    catchUp(index + FIGHT_AT)
    const event = events[index]
    if (event.kind === 'kill') {
      meet(index, event.killerId, event.victimId)
      // Read the victim fresh: the fight may have moved them.
      const down = pos[event.victimId]
      if (down) down.alive = false
    } else if (event.kind === 'plant') {
      const planted = layout.sites[event.site]
      const planter = roster.find((player) => player.id === event.playerId)
      // The planter kneels beside the spike, so the spike stays visible.
      if (planter && pos[planter.id].alive && planted) advance(planter, planted.post[0])
      if (planted)
        spike = { x: planted.plant.x, y: planted.plant.y, site: event.site, state: 'planted' }
    } else if (spike !== null) {
      const live: Spike = spike
      const defuser = roster.find((player) => player.id === event.playerId)
      if (defuser && pos[defuser.id].alive) advance(defuser, layout.sites[live.site].post[0])
      spike = { ...live, state: 'defused' }
    }
  }
  expecting(shown)
  catchUp(step)
  // Between a kill's fight and its death step, the fighters stand together and both are alive.
  const next = events[shown]
  if (next?.kind === 'kill' && step >= shown + FIGHT_AT) meet(shown, next.killerId, next.victimId)
  const finalSpike = spike as Spike | null
  if (finalSpike && step > events.length && round.endReason === 'detonation')
    spike = { ...finalSpike, state: 'detonated' }
  return { marks: roster.map((player) => pos[player.id]), spike }
}
