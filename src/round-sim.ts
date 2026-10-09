// Round-by-round detail for series the manager chooses to watch. None of this is saved: the
// watched series still produces an ordinary MatchResult (box score), and the replay lives only
// in memory while the viewer is open.
import type { Role } from './seed'

export type BuyType = 'pistol' | 'eco' | 'force' | 'full'
export type TeamBuy = { buy: BuyType; credits: number }
export type RoundEvent =
  | {
      kind: 'kill'
      time: number
      killerId: string
      victimId: string
      weapon: string
      headshot: boolean
      first: boolean
      assistId?: string
    }
  | { kind: 'plant'; time: number; playerId: string; site: string }
  | { kind: 'defuse'; time: number; playerId: string }
export type EndReason = 'elimination' | 'detonation' | 'defuse'
export type RoundReplay = {
  round: number
  overtime: boolean
  attackerId: string
  winnerId: string
  /** Map score after this round. */
  aScore: number
  bScore: number
  endReason: EndReason
  /** Round time in seconds when it ended. */
  endTime: number
  /** Buy for team A then team B, with average credits per player before buying. */
  buys: [TeamBuy, TeamBuy]
  events: RoundEvent[]
  clutch?: { playerId: string; versus: number }
  summary: string
}
export type MapReplay = { map: string; aId: string; bId: string; rounds: RoundReplay[] }
export type SeriesReplay = { maps: MapReplay[] }

export type Economy = { credits: number; lossStreak: number }
const START_CREDITS = 800
/** Every overtime round starts both teams on fresh, equal credits. */
export const OVERTIME_CREDITS = 5000
const MAX_CREDITS = 9000
const FULL_BUY = 3900
/** A half buy or better: enough to force with a rifle-and-utility-light loadout. */
const HALF_BUY = 2000
const HALF_BUY_SPEND = 2600
/** Below a half buy, a team on the brink still spends what it has rather than save. */
const BRINK_MIN = 1500
const LOSS_BONUS = [1900, 2400, 2900]

/** How readily a team forces, set by its tactical identity (the attack and defense dropdowns). */
export type Aggression = 'conservative' | 'balanced' | 'aggressive'
const attackAggression: Record<string, number> = {
  'Fast and explosive': 2,
  'Measured defaults': 1,
  'Slow information play': 0,
}
const defenseAggression: Record<string, number> = {
  'Proactive contesting': 2,
  'Disciplined retakes': 1,
  'Deep site anchors': 0,
}
/** Attack and defense each count 0-2; the sum sets the team's aggression. Defaults are balanced. */
export function aggressionFor(attackStyle: string, defenseStyle: string): Aggression {
  const score = (attackAggression[attackStyle] ?? 1) + (defenseAggression[defenseStyle] ?? 1)
  if (score >= 3) return 'aggressive'
  return score <= 1 ? 'conservative' : 'balanced'
}
/** Opponent's map score at which a team goes all in with what it has: the earlier, the more aggressive. */
const BRINK_SCORE: Record<Aggression, number> = { aggressive: 10, balanced: 11, conservative: 12 }

export function startingEconomy(round = 1): Economy {
  return { credits: round > 24 ? OVERTIME_CREDITS : START_CREDITS, lossStreak: 0 }
}

/**
 * Team buy for the round, and what it leaves in the bank. Credits are a per-player average.
 *
 * Saving only happens where it matters. Overtime resets the economy to 5,000 every round, and the
 * last round of a half is followed by a reset too, so neither is ever a save. Nor is a round in
 * which losing would put the opponent at match point or within reach of the map, which is set by
 * aggression: aggressive teams stop saving once the opponent is at 10, balanced at 11, and
 * conservative at 12. Those rounds are played out with whatever the bank holds.
 *
 * Elsewhere a team full buys when it can afford it, forces when its bank allows a half buy and
 * its strategy allows, and otherwise saves. Aggressive teams almost never save; balanced teams
 * save after a lost pistol or two losses; conservative teams save after any loss.
 */
export function chooseBuy(
  economy: Economy,
  round: number,
  score: { own: number; opp: number },
  aggression: Aggression = 'balanced',
): TeamBuy & { spend: number } {
  const credits = Math.round(economy.credits)
  if (round > 24) return { buy: 'full', credits, spend: Math.min(credits, FULL_BUY) }
  if (round === 1 || round === 13) return { buy: 'pistol', credits, spend: Math.min(credits, 650) }
  if (credits >= FULL_BUY) return { buy: 'full', credits, spend: FULL_BUY }
  const endOfHalf = round === 12 || round === 24
  if (endOfHalf || score.opp >= BRINK_SCORE[aggression]) {
    return credits >= BRINK_MIN
      ? { buy: 'force', credits, spend: credits }
      : { buy: 'eco', credits, spend: credits }
  }
  const lostPistol = (round === 2 || round === 14) && economy.lossStreak > 0
  const saving =
    aggression === 'aggressive'
      ? false
      : aggression === 'balanced'
        ? economy.lossStreak >= 2 || lostPistol
        : economy.lossStreak > 0
  if (credits >= HALF_BUY && !saving)
    return { buy: 'force', credits, spend: Math.min(credits, HALF_BUY_SPEND) }
  return { buy: 'eco', credits, spend: Math.min(credits, 400) }
}

/** How much a buy is worth in a gunfight, 0-1. */
export const buyStrength: Record<BuyType, number> = { pistol: 0.5, eco: 0.12, force: 0.55, full: 1 }
export const buyLabel: Record<BuyType, string> = {
  pistol: 'Pistol',
  eco: 'Eco',
  force: 'Force buy',
  full: 'Full buy',
}

/** Bank after the round: win/loss income, kills, plant bonus and guns carried by survivors. */
export function settleEconomy(
  economy: Economy,
  bought: { spend: number },
  won: boolean,
  kills: number,
  survivors: number,
  planted: boolean,
) {
  let credits = economy.credits - bought.spend
  if (won) {
    credits += 3000
    economy.lossStreak = 0
  } else {
    credits += LOSS_BONUS[Math.min(economy.lossStreak, LOSS_BONUS.length - 1)]
    economy.lossStreak++
  }
  credits += (kills * 200) / 5 + (planted ? 300 / 5 : 0)
  // Survivors keep their loadout, which is roughly a refund on next round's buy.
  credits += (survivors / 5) * bought.spend * 0.7
  economy.credits = Math.min(MAX_CREDITS, Math.max(0, credits))
}

const loadouts: Record<BuyType, string[]> = {
  pistol: ['Ghost', 'Ghost', 'Classic', 'Sheriff', 'Frenzy'],
  eco: ['Classic', 'Ghost', 'Sheriff', 'Sheriff', 'Stinger'],
  force: ['Spectre', 'Spectre', 'Bulldog', 'Marshal', 'Stinger', 'Judge'],
  full: ['Vandal', 'Vandal', 'Phantom', 'Phantom', 'Vandal'],
}
/** Main weapon a player carries this round; full-buy duelists and sentinels sometimes op. */
export function weaponFor(buy: BuyType, role: Role, roll: number, pick: number) {
  if (buy === 'full' && (role === 'Duelist' || role === 'Sentinel') && roll < 0.22)
    return 'Operator'
  const options = loadouts[buy]
  return options[Math.floor(pick * options.length) % options.length]
}

/** Seconds on the round clock as m:ss. */
export function clock(seconds: number) {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
