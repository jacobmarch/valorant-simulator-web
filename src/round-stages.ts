// Splits one watched round into stages and works out where every player stands at any step.
//
// A step is how far the round has played: step n means the first n events have happened. Each
// stage starts on a step and runs until the next one. Movement happens at a stage's start, right
// before its first event, so the map reads as "the players set up, then the hit comes".
//
// Players only ever stand on named points from the map layout (src/map-layouts.ts). Nothing here
// draws random numbers. The site comes from the sim's own plant (or, when nothing was planted,
// the site the attack goes for), and the kills, deaths and defuse come from the events it already
// wrote. Formations are picked from the map and round number, so the same round always lines up
// the same way.
import { layoutFor, type MapLayout, type Point, type SiteLayout } from './map-layouts'
import type { Role } from './seed'
import type { RoundReplay } from './round-sim'

export type StageKind = 'setup' | 'scout' | 'contact' | 'post-plant'
/**
 * A stage starts on a step. Steps are whole numbers for events, and the scouting beat sits at
 * 0.5: after setup, before the first event.
 */
export type Stage = { kind: StageKind; label: string; start: number }
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

/** Defence: how many hold the site the attack goes for; the rest sit off it. */
export const DEFENSE_FORMATIONS = ['4-1', '2-1-2', '3-2'] as const
export type DefenseFormation = (typeof DEFENSE_FORMATIONS)[number]
/** Attack: how the attackers go in once the hit starts, not counting the lurker. */
export const ATTACK_FORMATIONS = ['5-0', '2-1-2', '3-1-1'] as const
export type AttackFormation = (typeof ATTACK_FORMATIONS)[number]

type Roster = { id: string; side: Side }

/**
 * The attacker who lurks: the first Sentinel or Controller among the attackers, as a team usually
 * sends one to flank. With neither, the last attacker lurks, so one attacker is always apart.
 */
export function pickLurker(attackers: string[], roleOf: (id: string) => Role): string | undefined {
  const flanker = attackers.find((id) => roleOf(id) === 'Sentinel' || roleOf(id) === 'Controller')
  return flanker ?? attackers[attackers.length - 1]
}

/** The site the round is played on: the one the spike went down on, if it did. */
function plantedSite(round: RoundReplay): string | undefined {
  const plant = round.events.find((event) => event.kind === 'plant')
  return plant?.kind === 'plant' ? plant.site : undefined
}

/**
 * The site the fighting happens on. A planted round is played on the site it was planted on. A
 * round with no plant still needs a site, so the attack goes for one that alternates by round.
 */
export function hitSiteOf(layout: MapLayout, round: RoundReplay): string {
  return plantedSite(round) ?? layout.siteNames[round.round % layout.siteNames.length]
}

/**
 * How the attack opens. `main` means the attackers all start together in the main mid, and pick the
 * site from there. `default` means the attackers spread out on their usual formation and scout
 * with a lurker on a flank.
 */
export const ATTACK_OPENINGS = ['main', 'default'] as const
export type AttackOpening = (typeof ATTACK_OPENINGS)[number]

/**
 * Formations and opening for a round, picked from the map and round number so the same round
 * always repeats.
 */
export function formationsFor(
  map: string,
  round: number,
): { defense: DefenseFormation; attack: AttackFormation; opening: AttackOpening } {
  const seed = [...map].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7) + round
  return {
    defense: DEFENSE_FORMATIONS[seed % DEFENSE_FORMATIONS.length],
    attack: ATTACK_FORMATIONS[(seed * 5 + 1) % ATTACK_FORMATIONS.length],
    opening: ATTACK_OPENINGS[(seed * 7 + 3) % ATTACK_OPENINGS.length],
  }
}

/**
 * The defenders' setup. `main` of them stand on `mainSite`'s holds, and the rest stand at `off`.
 * The attack reads the setup, and the formation sets which site it goes for:
 * - 4-1: four hold the other site, so the attack pivots onto the hit site, where one defender waits.
 * - 2-1-2: two hold the hit site, one sits in mid, two hold the other site.
 * - 3-2: three hold the hit site, two hold the other site.
 */
function defenseSetup(
  formation: DefenseFormation,
  layout: MapLayout,
  hit: string,
): { main: number; mainSite: string; off: Point[] } {
  const other = layout.siteNames.find((name) => name !== hit) ?? hit
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

/**
 * The stages of a round, in order. Setup is always first. Scouting comes next when anything
 * happens, with the attackers in mid and the lurker out on a flank. Contact covers the fights
 * before the spike goes down, and is skipped when the spike goes down before the first kill.
 * Post-plant covers everything after the plant, including the defuse or detonation.
 */
export function roundStages(round: RoundReplay): Stage[] {
  const stages: Stage[] = [{ kind: 'setup', label: 'Setup', start: 0 }]
  const plantAt = round.events.findIndex((event) => event.kind === 'plant')
  const planted = plantAt !== -1
  if (round.events.length > 0) stages.push({ kind: 'scout', label: 'Scouting', start: 0.5 })
  if (planted ? plantAt >= 1 : round.events.length > 0)
    stages.push({ kind: 'contact', label: 'Contact', start: 1 })
  if (planted) stages.push({ kind: 'post-plant', label: 'Post-plant', start: plantAt + 1 })
  return stages
}

/** The next step the round can stop on after `step`: the next stage start, or the next event. */
export function stepAfter(stages: Stage[], step: number): number {
  const next = stages.find((stage) => stage.start > step)
  return Math.min(step + 1, next?.start ?? Number.POSITIVE_INFINITY)
}

/** Index into the stages of the stage a step falls in. */
export function stageIndexAt(stages: Stage[], step: number) {
  let index = 0
  stages.forEach((stage, at) => {
    if (stage.start <= step) index = at
  })
  return index
}

/**
 * Where everyone stands after the first `step` events of a round.
 *
 * - Setup: attackers spawn; defenders take their formation on the hit site's holds and the
 *   off-site points.
 * - Contact: the lurker takes the hit site's lurk spot. The other attackers go in to the entry
 *   and lanes in their formation. Defenders off the site rotate onto its holds. Every fight is
 *   therefore on the hit site, not in mid. Kills happen where the fighters stand; victims stay
 *   where they fell, marked dead.
 * - Post-plant: attackers stand round the spike, defenders come in to the site's retake points.
 * - The planter and the defuser stand beside the spike, on the site's first post point.
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
  const stages = roundStages(round)
  const hit = hitSiteOf(layout, round)
  const site = layout.sites[hit]
  const formations = formationsFor(map, round.round)
  const defense = defenseSetup(formations.defense, layout, hit)
  const mainHolds = layout.sites[defense.mainSite].holds
  const roster: Roster[] = [
    ...sides.a.map((id) => ({ id, side: 'a' as const })),
    ...sides.b.map((id) => ({ id, side: 'b' as const })),
  ]
  const attacking = (player: Roster) => player.side === attackerSide
  const attackers = roster.filter(attacking)
  const defenders = roster.filter((player) => !attacking(player))
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
  // Where each side can fight on this site before the spike goes down, so a kill can be placed on
  // the points they hold. After the plant the post and retake points are in play too.
  const attackSpots = [...site.entry, ...site.lanes, site.lurk[0]]
  const defenseSpots = [...site.holds, ...site.retake]

  attackers.forEach((player, at) =>
    place(player, layout.attackSpawn[at % layout.attackSpawn.length]),
  )
  defenders.forEach((player, at) =>
    place(
      player,
      at < defense.main ? mainHolds[at] : defense.off[(at - defense.main) % defense.off.length],
    ),
  )

  let spike: Spike | null = null
  // Movement for a stage, applied before its first event (or at its start, for scouting).
  const applyStart = (stage: Stage) => {
    if (stage.kind === 'scout') {
      // The lurker reads the map from a flank while the rest look in from mid. The defence does not
      // move yet: it answers once the attack is in.
      const living = alive(attackers)
      const lurker = living.find((player) => player.id === lurkerId)
      const others = living.filter((player) => player !== lurker)
      // Opening in the main mid, the attackers stand together. Opening on the default, they spread
      // out as their formation has them.
      const staging =
        formations.opening === 'main'
          ? [layout.mid[0], layout.mid[1], layout.mid[2], layout.mid[3]]
          : ATTACK_STAGING[formations.attack](layout)
      others.forEach((player, at) => place(player, staging[at % staging.length]))
      if (lurker) place(lurker, layout.flank[0])
    }
    if (stage.kind === 'contact') {
      const living = alive(attackers)
      const lurker = living.find((player) => player.id === lurkerId)
      const others = living.filter((player) => player !== lurker)
      const slots = ATTACK_HITS[formations.attack](site)
      others.forEach((player, at) => place(player, slots[at % slots.length]))
      if (lurker) place(lurker, site.lurk[0])
      // The defence answers. Three or more holding the site fight it while the rest rotate in.
      // Fewer fall off to the retake points, and the rest of the team plays the retake.
      const live = alive(defenders)
      const holding = live.filter((player) => standsOn(pos[player.id], site.holds))
      if (holding.length >= 3) {
        const free = site.holds.filter(
          (spot) => !live.some((player) => standsOn(pos[player.id], [spot])),
        )
        live
          .filter((player) => !standsOn(pos[player.id], site.holds))
          .forEach((player, at) => place(player, free[at % free.length]))
      } else holding.forEach((player, at) => place(player, site.retake[at % site.retake.length]))
    }
    if (stage.kind === 'post-plant') {
      alive(attackers).forEach((player, at) => place(player, site.post[at % site.post.length]))
      alive(defenders).forEach((player, at) => place(player, site.retake[at % site.retake.length]))
    }
  }

  const shown = Math.min(Math.floor(step), round.events.length)
  const scout = stages.find((stage) => stage.kind === 'scout')
  if (scout && step >= scout.start) applyStart(scout)
  for (let index = 0; index < shown; index++) {
    stages.forEach((stage) => {
      if (stage.start === index + 1 && stage.start > 0) applyStart(stage)
    })
    const event = round.events[index]
    if (event.kind === 'kill') {
      const victim = pos[event.victimId]
      const killer = pos[event.killerId]
      if (victim?.alive && killer?.alive) {
        const planted = spike !== null
        const spotsFor = (mark: Mark) =>
          mark.attacking
            ? planted
              ? [...attackSpots, ...site.post]
              : attackSpots
            : planted
              ? [...defenseSpots, ...site.retake]
              : defenseSpots
        // A spot nobody living is on, so two players never share one.
        const taken = (spot: Point, self: string) =>
          Object.values(pos).some(
            (mark) => mark.alive && mark.id !== self && mark.x === spot.x && mark.y === spot.y,
          )
        // Puts a player on the hit site if they are not already on it, and in range of the other
        // player in the fight. The victim settles first, then the killer closes in on them.
        const settle = (id: string, otherId: string) => {
          const mark = pos[id]
          const other = pos[otherId]
          const spots = spotsFor(mark)
          if (standsOn(mark, spots) && distance(mark, other) <= FIGHT_RANGE) return
          const free = spots.filter((spot) => !taken(spot, id))
          const pool = free.length > 0 ? free : spots
          const nearest = pool.reduce((best, spot) =>
            distance(spot, other) < distance(best, other) ? spot : best,
          )
          place({ id, side: mark.side }, nearest)
        }
        settle(event.victimId, event.killerId)
        settle(event.killerId, event.victimId)
      }
      // Read the victim again: settling may have replaced their mark.
      const fallen = pos[event.victimId]
      if (fallen) fallen.alive = false
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
  const finalSpike = spike as Spike | null
  if (finalSpike && step > round.events.length && round.endReason === 'detonation')
    spike = { ...finalSpike, state: 'detonated' }
  return { marks: roster.map((player) => pos[player.id]), spike }
}
