// Splits one watched round into stages and works out where every player stands at any step.
//
// A step is how far the round has played: step n means the first n events have happened. Each
// stage starts on a step and runs until the next one. Movement happens at a stage's start, right
// before its first event, so the map reads as "the players rotate, then the fight starts".
//
// Players only ever stand on named points from the map layout (src/map-layouts.ts). Nothing here
// draws random numbers. The site comes from the sim's own plant, and the kills, deaths and
// defuse come from the events it already wrote.
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

type Roster = { id: string; side: Side }

/** Takes the first of each list, then the second of each, and so on. */
function interleave<T>(lists: T[][]): T[] {
  const longest = Math.max(0, ...lists.map((list) => list.length))
  return Array.from({ length: longest }, (_, at) => lists.map((list) => list[at]))
    .flat()
    .filter((item): item is T => item !== undefined)
}

/** The site the round is played on: the one the spike went down on, if it did. */
function plantedSite(round: RoundReplay): string | undefined {
  const plant = round.events.find((event) => event.kind === 'plant')
  return plant?.kind === 'plant' ? plant.site : undefined
}

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

/**
 * Where everyone stands after the first `step` events of a round.
 *
 * - Setup: attackers spawn; defenders wait on the holds of the site the round is played on (or
 *   spread across every site if the spike never went down).
 * - Contact: attackers move up to that site's entry points (or to mid if no site was taken).
 *   Kills happen where the fighters stand; victims stay where they fell, marked dead.
 * - Post-plant: attackers stand round the spike, defenders come in to the site's retake points.
 * - The planter and the defuser stand beside the spike, on the site's first post point.
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
  const site = plantedSite(round)
  const siteLayout = site ? layout.sites[site] : undefined
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

  attackers.forEach((player, at) =>
    place(player, layout.attackSpawn[at % layout.attackSpawn.length]),
  )
  const holds = siteLayout
    ? siteLayout.holds
    : interleave(layout.siteNames.map((name) => layout.sites[name].holds))
  defenders.forEach((player, at) => place(player, holds[at % holds.length]))

  let spike: Spike | null = null
  // Movement for the stage that starts at `index + 1`, applied just before event `index`.
  const applyStart = (stage: Stage) => {
    if (stage.kind === 'contact') {
      const points = siteLayout ? siteLayout.entry : layout.mid
      alive(attackers).forEach((player, at) => place(player, points[at % points.length]))
    }
    if (stage.kind === 'post-plant' && siteLayout) {
      alive(attackers).forEach((player, at) =>
        place(player, siteLayout.post[at % siteLayout.post.length]),
      )
      alive(defenders).forEach((player, at) =>
        place(player, siteLayout.retake[at % siteLayout.retake.length]),
      )
    }
  }

  const shown = Math.min(step, round.events.length)
  for (let index = 0; index < shown; index++) {
    stages.forEach((stage) => {
      if (stage.start === index + 1 && stage.start > 0) applyStart(stage)
    })
    const event = round.events[index]
    if (event.kind === 'kill') {
      const victim = pos[event.victimId]
      if (victim) victim.alive = false
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
