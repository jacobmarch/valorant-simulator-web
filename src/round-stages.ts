// Splits one watched round into stages and works out where every player stands at any step.
//
// A step is how far the round has played: step n means the first n events have happened. Each
// stage starts on a step and runs until the next one. Movement happens at a stage's start,
// right before its first event, so the map reads as "the players rotate, then the fight starts".
//
// Nothing here draws random numbers. Positions come from the events the sim already wrote:
// who attacked, where the spike went, who died and when, and who defused.
import { layoutFor, type MapLayout, type Point } from './map-layouts'
import type { RoundReplay } from './round-sim'

export type StageKind = 'setup' | 'contact' | 'post-plant'
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

/**
 * The stages of a round, in order. Setup is always first. Contact covers the fights before the
 * spike goes down, and is skipped when the spike goes down before the first kill. Post-plant
 * covers everything after the plant, including the defuse or detonation.
 */
export function roundStages(round: RoundReplay): Stage[] {
  const stages: Stage[] = [{ kind: 'setup', label: 'Setup', start: 0 }]
  const plantAt = round.events.findIndex((event) => event.kind === 'plant')
  const planted = plantAt !== -1
  if (planted ? plantAt >= 1 : round.events.length > 0)
    stages.push({ kind: 'contact', label: 'Contact', start: 1 })
  if (planted) stages.push({ kind: 'post-plant', label: 'Post-plant', start: plantAt + 1 })
  return stages
}

/** Index into the stages of the stage a step falls in. */
export function stageIndexAt(stages: Stage[], step: number) {
  let index = 0
  stages.forEach((stage, at) => {
    if (stage.start <= step) index = at
  })
  return index
}

type Roster = { id: string; side: Side }

/** Takes the first of each list, then the second of each, and so on. */
function interleave<T>(lists: T[][]): T[] {
  const longest = Math.max(0, ...lists.map((list) => list.length))
  return Array.from({ length: longest }, (_, at) => lists.map((list) => list[at]))
    .flat()
    .filter((item): item is T => item !== undefined)
}

/**
 * Where everyone stands after the first `step` events of a round.
 *
 * - Setup: attackers spawn, defenders are already in their site holds.
 * - Contact: attackers move up to mid and the fights happen there.
 * - Post-plant: alive attackers fan out round the spike, alive defenders come in to retake.
 * - Kills leave the victim where they fell, marked dead.
 * - The planter and the defuser stand beside the spike, on the site's first post spot.
 */
export function roundFrame(
  map: string,
  round: RoundReplay,
  sides: { a: string[]; b: string[] },
  attackerSide: Side,
  step: number,
): RoundFrame {
  const layout: MapLayout = layoutFor(map)
  const stages = roundStages(round)
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
  // Defenders spread across every site before doubling up, so no site is left open at setup.
  const holds = interleave(layout.siteNames.map((name) => layout.sites[name].holds))
  attackers.forEach((player, at) =>
    place(player, layout.attackSpawn[at % layout.attackSpawn.length]),
  )
  defenders.forEach((player, at) => place(player, holds[at % holds.length]))

  let spike: Spike | null = null
  // Movement for the stage that starts at `index + 1`, applied just before event `index`.
  const applyStart = (stage: Stage, site: string | undefined) => {
    if (stage.kind === 'contact') {
      alive(attackers).forEach((player, at) => place(player, layout.mid[at % layout.mid.length]))
    }
    if (stage.kind === 'post-plant' && site) {
      const siteLayout = layout.sites[site]
      alive(attackers).forEach((player, at) =>
        place(player, siteLayout.post[at % siteLayout.post.length]),
      )
      alive(defenders).forEach((player, at) =>
        place(player, siteLayout.retake[at % siteLayout.retake.length]),
      )
    }
  }

  const plantSite = round.events.find((event) => event.kind === 'plant')
  const shown = Math.min(step, round.events.length)
  for (let index = 0; index < shown; index++) {
    stages.forEach((stage) => {
      if (stage.start === index + 1 && stage.start > 0)
        applyStart(stage, plantSite?.kind === 'plant' ? plantSite.site : undefined)
    })
    const event = round.events[index]
    if (event.kind === 'kill') {
      const victim = pos[event.victimId]
      if (victim) victim.alive = false
    } else if (event.kind === 'plant') {
      const site = layout.sites[event.site]
      const planter = pos[event.playerId]
      // The planter kneels beside the spike, so the spike stays visible.
      if (planter?.alive && site) place({ id: event.playerId, side: planter.side }, site.post[0])
      if (site) spike = { x: site.plant.x, y: site.plant.y, site: event.site, state: 'planted' }
    } else if (spike !== null) {
      const live: Spike = spike
      const defuser = pos[event.playerId]
      if (defuser?.alive)
        place({ id: event.playerId, side: defuser.side }, layout.sites[live.site].plant)
      spike = { ...live, state: 'defused' }
    }
  }
  const finalSpike = spike as Spike | null
  if (finalSpike && step > round.events.length && round.endReason === 'detonation')
    spike = { ...finalSpike, state: 'detonated' }
  return { marks: roster.map((player) => pos[player.id]), spike }
}
