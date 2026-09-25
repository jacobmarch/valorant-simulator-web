// Player development: potential, age curves, form and morale.
// Pure helpers so the weekly and per-match rules are easy to test in isolation.
import { skills } from './seed'

type Skill = (typeof skills)[number]
type Ratings = Record<Skill, number>
type PlayerStatus = 'starter' | 'substitute' | 'inactive' | 'free-agent'
type DevelopingPlayer = {
  ratings: Ratings
  age: number
  potential: number
  form: number
  morale: number
  status: PlayerStatus
}

export const FORM_LIMIT = 6
export const MORALE_MIN = 5
export const MORALE_MAX = 95
export const MORALE_DEFAULT = 60
// Default weekly plan for players the manager does not train (AI rosters, free agents).
export const DEFAULT_TRAINING: Record<Skill, number> = {
  Mechanics: 7,
  Tactics: 7,
  Utility: 7,
  Consistency: 7,
  Clutch: 6,
  Teamplay: 6,
}
// Skills that fade first with age; the rest are experience skills that hold longer.
const physicalSkills = new Set<Skill>(['Mechanics', 'Clutch'])

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const tenth = (value: number) => Math.round(value * 10) / 10

export function overallRating(ratings: Ratings) {
  return Object.values(ratings).reduce((sum, value) => sum + value, 0) / skills.length
}

// Younger players get more headroom above their current overall.
export function seedPotential(currentOverall: number, age: number, jitter: number) {
  const headroom = age <= 20 ? 12 : age <= 23 ? 8 : age <= 26 ? 4 : 1
  return Math.round(clamp(currentOverall + headroom + jitter, currentOverall, 99))
}

export function ageGrowthMultiplier(age: number) {
  if (age <= 20) return 1.5
  if (age <= 23) return 1.25
  if (age <= 26) return 1
  if (age <= 29) return 0.7
  return 0.45
}

// Weekly chance of losing a point to age, independent of training.
export function ageDeclineChance(age: number, skill: Skill) {
  if (physicalSkills.has(skill)) return age <= 26 ? 0 : Math.min(0.14, (age - 26) * 0.02)
  return age <= 30 ? 0 : Math.min(0.08, (age - 30) * 0.01)
}

// Growth slows sharply once a player reaches their potential.
export function potentialFactor(currentOverall: number, potential: number) {
  const gap = potential - currentOverall
  if (gap <= 0) return 0.08
  return Math.min(1, 0.35 + gap * 0.13)
}

export function moraleGrowthFactor(morale: number) {
  return 0.8 + clamp(morale, 0, 100) / 250
}

// Strength points added to a player's rating in the match engine.
export function conditionBonus(player: Pick<DevelopingPlayer, 'form' | 'morale'>) {
  return (player.form ?? 0) + ((player.morale ?? MORALE_DEFAULT) - 50) / 25
}

// Form tracks recent individual performance; ACS around 200 is neutral.
export function formAfterSeries(form: number, averageAcs: number, won: boolean) {
  return tenth(
    clamp(form * 0.5 + (averageAcs - 200) / 40 + (won ? 0.75 : -0.75), -FORM_LIMIT, FORM_LIMIT),
  )
}

export function moraleAfterSeries(morale: number, won: boolean) {
  return clamp(morale + (won ? 4 : -5), MORALE_MIN, MORALE_MAX)
}

export function moraleTarget(status: PlayerStatus) {
  if (status === 'starter') return 55
  if (status === 'substitute') return 42
  if (status === 'inactive') return 35
  return 45
}

// Morale drifts toward what the player's role on the team justifies.
export function weeklyMorale(morale: number, status: PlayerStatus) {
  const diff = moraleTarget(status) - morale
  return clamp(morale + Math.sign(diff) * Math.min(2, Math.abs(diff)), MORALE_MIN, MORALE_MAX)
}

export function weeklyForm(form: number) {
  return tenth(form * 0.8)
}

// One week of training and aging for one player. Mutates ratings.
export function developPlayer(
  player: DevelopingPlayer,
  allocation: Partial<Record<Skill, number>>,
  random: () => number,
) {
  const growth =
    ageGrowthMultiplier(player.age) *
    potentialFactor(overallRating(player.ratings), player.potential) *
    moraleGrowthFactor(player.morale)
  skills.forEach((skill) => {
    const hours = allocation[skill] ?? 0
    if (hours < 5 && random() < 0.13) player.ratings[skill] = Math.max(1, player.ratings[skill] - 1)
    if (hours > 5 && random() < Math.min(0.42, (hours - 5) * 0.026) * growth)
      player.ratings[skill] = Math.min(100, player.ratings[skill] + 1)
    const decline = ageDeclineChance(player.age, skill)
    if (decline && random() < decline)
      player.ratings[skill] = Math.max(1, player.ratings[skill] - 1)
  })
  player.form = weeklyForm(player.form)
  player.morale = weeklyMorale(player.morale, player.status)
}

// Birthday at season rollover; veterans' ceilings shrink each year.
export function agePlayer(player: DevelopingPlayer) {
  player.age++
  if (player.age >= 28)
    player.potential = Math.max(40, player.potential - (player.age >= 31 ? 2 : 1))
}
