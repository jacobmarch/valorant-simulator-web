// Player development: potential, age curves, form and morale.
// Pure helpers so the weekly and per-match rules are easy to test in isolation.
import { skills } from './seed'

type Skill = (typeof skills)[number]
type Ratings = Record<Skill, number>
type PlayerStatus = 'starter' | 'substitute' | 'inactive' | 'free-agent' | 'retired'
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
  const headroom = age <= 20 ? 8 : age <= 23 ? 5 : age <= 26 ? 2 : 0
  return Math.round(clamp(currentOverall + headroom + jitter, currentOverall, 90))
}

// Ceiling for a newly generated prospect. Most top out as solid pros; about one in
// fifteen can become a star (88+) and roughly one in thirty a 90+ talent.
export function prospectPotential(currentOverall: number, roll: number) {
  return Math.round(clamp(67 + 28 * roll ** 2, currentOverall + 3, 94))
}

export function ageGrowthMultiplier(age: number) {
  if (age <= 20) return 1.5
  if (age <= 23) return 1.25
  if (age <= 25) return 1
  if (age <= 27) return 0.6
  return 0.3
}

// Weekly chance of losing a point to age, independent of training.
// Aim and clutch fade from the mid-twenties; game sense holds a few years longer.
export function ageDeclineChance(age: number, skill: Skill) {
  if (physicalSkills.has(skill)) return age <= 25 ? 0 : Math.min(0.2, (age - 25) * 0.025)
  return age <= 28 ? 0 : Math.min(0.12, (age - 28) * 0.02)
}

// Growth stops once a player reaches their potential.
export function potentialFactor(currentOverall: number, potential: number) {
  const gap = potential - currentOverall
  if (gap <= 0) return 0
  return Math.min(1, 0.3 + gap * 0.12)
}

// Weekly chance per skill of slipping back toward a ceiling the player has outgrown
// (potential shrinks with age, so this is how veterans' ratings come down).
export function overshootDeclineChance(currentOverall: number, potential: number) {
  const over = currentOverall - potential
  return over <= 0 ? 0 : Math.min(0.25, over * 0.03)
}

// Chance a player hangs up their mouse at season rollover. Only players whose
// contract has run out (or who are unsigned) can retire.
export function retirementChance(age: number, currentOverall: number, unsigned: boolean) {
  const byAge =
    age <= 25
      ? 0
      : age <= 27
        ? 0.04
        : age <= 29
          ? 0.12
          : age <= 31
            ? 0.3
            : age <= 33
              ? 0.55
              : age <= 35
                ? 0.85
                : 1
  // Players nobody signs drift out of the scene, faster once they are no longer young.
  const fringe = !unsigned || age < 20 ? 0 : age >= 24 && currentOverall < 72 ? 0.5 : 0.2
  return Math.min(1, byAge + fringe)
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
  const overall = overallRating(player.ratings)
  const growth =
    ageGrowthMultiplier(player.age) *
    potentialFactor(overall, player.potential) *
    moraleGrowthFactor(player.morale)
  const overshoot = overshootDeclineChance(overall, player.potential)
  skills.forEach((skill) => {
    const hours = allocation[skill] ?? 0
    if (hours < 5 && random() < 0.13) player.ratings[skill] = Math.max(1, player.ratings[skill] - 1)
    if (hours > 5 && random() < Math.min(0.42, (hours - 5) * 0.026) * growth)
      player.ratings[skill] = Math.min(100, player.ratings[skill] + 1)
    const decline = ageDeclineChance(player.age, skill)
    if (decline && random() < decline)
      player.ratings[skill] = Math.max(1, player.ratings[skill] - 1)
    if (overshoot && random() < overshoot)
      player.ratings[skill] = Math.max(1, player.ratings[skill] - 1)
  })
  player.form = weeklyForm(player.form)
  player.morale = weeklyMorale(player.morale, player.status)
}

// Birthday at season rollover; ceilings shrink every year from the mid-twenties.
export function potentialDecline(age: number) {
  return age <= 25 ? 0 : age <= 27 ? 1 : age <= 29 ? 2 : 3
}
export function agePlayer(player: DevelopingPlayer) {
  player.age++
  player.potential = Math.max(40, player.potential - potentialDecline(player.age))
}
