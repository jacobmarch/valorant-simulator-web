// The decisions behind one watched round: what the attack and defence are trying to do, and the
// beats the round passes through. Nothing here moves a player; round-stages.ts turns a plan into
// positions. The plan is a pure function of the map and the round, so a round always plays out the
// same way when you watch it again, but it is seeded from the round's content (who attacked, who
// won, when the kills fell), so two matches on the same map do not repeat each other.
//
// The sim still decides the result. A plan only chooses how the round looks on the way to it.
import { layoutFor, type MapLayout } from './map-layouts'
import type { RoundReplay } from './round-sim'

/**
 * Defence: how many players start in each lane, left to right: the left site, mid, the right
 * site. On a three-site map the middle lane is the B site and mid is held by a pusher.
 */
export const DEFENSE_FORMATIONS = ['2-2-1', '2-1-2', '3-1-1'] as const
export type DefenseFormation = (typeof DEFENSE_FORMATIONS)[number]
/** Attack: how the attackers go in once the hit starts, not counting the lurker. */
export const ATTACK_FORMATIONS = ['5-0', '2-1-2', '3-1-1'] as const
export type AttackFormation = (typeof ATTACK_FORMATIONS)[number]

/**
 * How the attack opens, before it commits to a site:
 * - `mid`: the attackers stand together in the middle of the map.
 * - `a-main` / `b-main` / `c-main`: the attackers start on the main route to that site, at its
 *   entry. They can still pivot onto another site at contact. `c-main` only exists on maps with a
 *   third site.
 * - `default`: the attackers spread out as their formation has them, with the lurker on a flank.
 */
export const ATTACK_OPENINGS = ['mid', 'a-main', 'b-main', 'default'] as const
export const THREE_SITE_OPENINGS = [...ATTACK_OPENINGS, 'c-main'] as const
export type AttackOpening = (typeof THREE_SITE_OPENINGS)[number]

/**
 * What the attack is doing this round:
 * - `default`: take map control from the opening, then hit once the defence is read.
 * - `rush`: go straight at the site with no control phase.
 * - `split`: reach the site from two routes at once.
 * - `fake`: show on one site with a pair, then bring them round to hit the other.
 * - `slow`: take the whole map first, fight for control, and hit late.
 */
export const ATTACK_PLANS = ['default', 'rush', 'split', 'fake', 'slow'] as const
export type AttackPlan = (typeof ATTACK_PLANS)[number]

export type RoundPlan = {
  /** The site the fighting ends up on. */
  hit: string
  /** The site a fake shows on, when the plan is a fake. */
  fake: string
  attack: AttackPlan
  opening: AttackOpening
  formation: AttackFormation
  defense: DefenseFormation
  /** A defender pushes forward early for information, and fights for it. */
  push: boolean
  /** The defence reads the attack and starts rotating before the hit lands. */
  reads: boolean
  /** Retakers come in stacked on two points, or spread over all of them. */
  retake: 'tight' | 'wide'
  /** Which flank the lurker starts on. */
  flank: 0 | 1
  /** The lurker takes the site's lurk spot during map control, rather than at the hit. */
  lurkEarly: boolean
  /** How many kills fall in the map-control phase, before the hit. */
  hitIndex: number
  /** Who takes which slot: shuffled so the same players are not always on the same spot. */
  attackOrder: number[]
  defenseOrder: number[]
}

export type StageKind =
  | 'setup'
  | 'opening'
  | 'control'
  | 'read'
  | 'hit'
  | 'rotate'
  | 'post-plant'
  | 'retake'
/**
 * A stage starts on a step. A step is how many events have happened: whole numbers are the events
 * themselves, and a fractional step is a beat between two events (0.25 comes after setup, before
 * the first event). Every stage after setup starts on a fractional step, so a stage's movement
 * shows before the event that follows it.
 */
export type Stage = { kind: StageKind; label: string; start: number }

function hash(text: string) {
  let value = 2166136261
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619)
  return value >>> 0
}

/** A small seeded generator (mulberry32): the same seed always draws the same numbers. */
function generator(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled(length: number, next: () => number) {
  const order = Array.from({ length }, (_, at) => at)
  for (let at = length - 1; at > 0; at--) {
    const swap = Math.floor(next() * (at + 1))
    ;[order[at], order[swap]] = [order[swap], order[at]]
  }
  return order
}

/** The site the spike went down on, if it did. */
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

/** Attack plans, weighted: defaults and slow plays are the most common, rushes the least. */
const PLAN_POOL: AttackPlan[] = ['default', 'default', 'slow', 'split', 'fake', 'fake', 'rush']
/** Seconds into the round at which each plan gives up map control and hits. */
const HIT_TIME: Record<AttackPlan, [number, number]> = {
  rush: [4, 10],
  split: [16, 12],
  default: [22, 16],
  fake: [28, 12],
  slow: [38, 16],
}
/** Most kills that can fall before the hit; the rest of the round is played on the site. */
const MAX_CONTROL_KILLS = 3

export function roundPlan(map: string, round: RoundReplay): RoundPlan {
  const layout = layoutFor(map)
  const hit = hitSiteOf(layout, round)
  const seed = hash(
    [
      map,
      round.round,
      round.attackerId,
      round.winnerId,
      round.events.length,
      Math.round(round.endTime * 10),
      ...round.events.slice(0, 4).map((event) => Math.round(event.time * 10)),
    ].join('|'),
  )
  const next = generator(seed)
  const pick = <T>(list: readonly T[]) => list[Math.floor(next() * list.length)]

  const attack = pick(PLAN_POOL)
  const others = layout.siteNames.filter((name) => name !== hit)
  const openings = layout.siteNames.length >= 3 ? THREE_SITE_OPENINGS : ATTACK_OPENINGS
  const mainOf = `${hit.toLowerCase()}-main` as AttackOpening
  const opening = attack === 'rush' || attack === 'split' ? mainOf : pick(openings)

  // Map control lasts until the plan's hit time. Kills before that fall in the control phase, up
  // to a cap, and only kills: a plant always comes in the hit.
  const plantAt = round.events.findIndex((event) => event.kind === 'plant')
  const room = Math.min(MAX_CONTROL_KILLS, plantAt === -1 ? round.events.length - 1 : plantAt)
  const [base, spread] = HIT_TIME[attack]
  const hitTime = base + next() * spread
  let hitIndex = 0
  while (
    hitIndex < room &&
    round.events[hitIndex].kind === 'kill' &&
    round.events[hitIndex].time < hitTime
  )
    hitIndex++

  return {
    hit,
    fake: pick(others),
    attack,
    opening,
    formation: pick(ATTACK_FORMATIONS),
    defense: pick(DEFENSE_FORMATIONS),
    push: next() < 0.35,
    reads: attack !== 'rush' && next() < 0.5,
    retake: pick(['tight', 'wide'] as const),
    flank: next() < 0.5 ? 0 : 1,
    lurkEarly: next() < 0.4,
    hitIndex,
    attackOrder: shuffled(5, next),
    defenseOrder: shuffled(5, next),
    flip: next() < 0.5,
  }
}

const upper = (text: string) => text.toUpperCase()

/**
 * The beats of a round, in order. Setup comes first. The opening and map control follow, then any
 * early kills, then the defence reads and the attack hits. The fight, the rotation that arrives
 * partway through it, the post-plant and the retake come after.
 */
export function roundStages(map: string, round: RoundReplay): Stage[] {
  const stages: Stage[] = [{ kind: 'setup', label: 'Setup', start: 0 }]
  const count = round.events.length
  if (count === 0) return stages
  const plan = roundPlan(map, round)
  const openingLabel: Record<AttackPlan, string> = {
    default: plan.opening === 'default' ? 'Default spread' : upper(plan.opening.replace('-', ' ')),
    rush: 'Rush',
    split: 'Split approach',
    fake: `Show on ${plan.fake}`,
    slow: 'Slow opening',
  }
  stages.push({ kind: 'opening', label: openingLabel[plan.attack], start: 0.25 })
  if (plan.attack !== 'rush' && plan.attack !== 'split')
    stages.push({ kind: 'control', label: 'Map control', start: 0.5 })
  const hit = plan.hitIndex
  const plantAt = round.events.findIndex((event) => event.kind === 'plant')
  stages.push({ kind: 'read', label: 'Reads', start: hit + 0.6 })
  // A plant on the first event after control is the hit; the post-plant stage covers it.
  if (plantAt !== hit) stages.push({ kind: 'hit', label: `${plan.hit} hit`, start: hit + 0.8 })
  if (round.events[hit].kind === 'kill' && hit + 1 < count && (plantAt === -1 || plantAt > hit))
    stages.push({ kind: 'rotate', label: 'Rotation', start: hit + 1.5 })
  if (plantAt !== -1) {
    stages.push({ kind: 'post-plant', label: 'Post-plant', start: plantAt + 0.8 })
    if (plantAt + 1 < count) stages.push({ kind: 'retake', label: 'Retake', start: plantAt + 1.5 })
  }
  return stages
}

/**
 * How far into a kill's step the fight shows: the fighters have moved together and nobody has
 * died yet. The death lands on the whole step after.
 */
export const FIGHT_AT = 0.9

/**
 * The next step the round can stop on after `step`: the next stage start, the next event, and,
 * when the round is given, the moment before each kill when its fighters have met.
 */
export function stepAfter(stages: Stage[], step: number, round?: RoundReplay): number {
  const next = stages.find((stage) => stage.start > step)
  let stop = Math.min(Math.floor(step) + 1, next?.start ?? Number.POSITIVE_INFINITY)
  if (round) {
    const index = Math.floor(step)
    if (round.events[index]?.kind === 'kill' && index + FIGHT_AT > step)
      stop = Math.min(stop, index + FIGHT_AT)
  }
  return stop
}

/** Index into the stages of the stage a step falls in. */
export function stageIndexAt(stages: Stage[], step: number) {
  let index = 0
  stages.forEach((stage, at) => {
    if (stage.start <= step) index = at
  })
  return index
}
