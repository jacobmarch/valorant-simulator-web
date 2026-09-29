// Yearly sponsor contracts. Every organization signs one sponsor per season: a weekly base
// that runs alongside salaries, plus a bonus paid when the competitive season ends (week 43)
// if the team hit the sponsor's goal. Which offers a team sees depends on its prestige.
import type { Fixture, GameState, Team } from './game'
import { previousChampionsByRegion } from './seed'

export type SponsorTier = 'easy' | 'medium' | 'high'
export type SponsorLevel = 'Regional' | 'Contender' | 'Champions'
export type SponsorGoal =
  | 'stage-playoffs'
  | 'masters'
  | 'champions'
  | 'champions-playoffs'
  | 'international-title'
export type SponsorContract = {
  id: string
  sponsor: string
  /** The season whose results decide the bonus. */
  season: number
  tier: SponsorTier
  level: SponsorLevel
  weekly: number
  bonus: number
  goal: SponsorGoal
  /** Set once the bonus has been decided at the end of the season. */
  bonusPaid?: boolean
  settled?: boolean
}
export type SponsorOffers = {
  teamId: string
  season: number
  deadlineSeason: number
  deadlineWeek: number
  offers: SponsorContract[]
}
export type SeasonSummary = {
  season: number
  score: number
  titles: string[]
  best: string
  /** Prestige lost for missing the sponsor goal this season. */
  sponsorPenalty?: number
}

/** Week the competitive season is over: bonuses pay out and next year's offers arrive. */
export const SPONSOR_SETTLE_WEEK = 43
export const tiers: SponsorTier[] = ['easy', 'medium', 'high']
export const tierLabels: Record<SponsorTier, string> = {
  easy: 'Easy',
  medium: 'Medium',
  high: 'High',
}
export const goalLabels: Record<SponsorGoal, string> = {
  'stage-playoffs': 'Reach a Stage playoff bracket',
  masters: 'Qualify for a Masters event',
  champions: 'Qualify for Champions',
  'champions-playoffs': 'Reach the Champions playoffs',
  'international-title': 'Win Masters or Champions',
}
/** The goal as a phrase that continues a sentence. */
export const goalPhrase = (goal: SponsorGoal) =>
  goalLabels[goal][0].toLowerCase() + goalLabels[goal].slice(1)
const goalsByLevel: Record<SponsorLevel, Record<SponsorTier, SponsorGoal>> = {
  Regional: { easy: 'stage-playoffs', medium: 'masters', high: 'champions' },
  Contender: { easy: 'masters', medium: 'champions', high: 'champions-playoffs' },
  Champions: { easy: 'champions', medium: 'champions-playoffs', high: 'international-title' },
}
// Annual base for a medium deal at each level; tiers scale it.
const levelValue: Record<SponsorLevel, number> = {
  Regional: 600000,
  Contender: 750000,
  Champions: 900000,
}
const baseScale: Record<SponsorTier, number> = { easy: 0.8, medium: 1, high: 1.25 }
const bonusScale: Record<SponsorTier, number> = { easy: 0.15, medium: 0.35, high: 0.7 }
/** Prestige lost when a team misses its sponsor's goal. Easy deals carry no risk. */
export const missPenalty: Record<SponsorTier, number> = { easy: 0, medium: 5, high: 12 }
const sponsorNames: Record<SponsorLevel, string[]> = {
  Regional: [
    'Northgate Mobile',
    'Pixel Pantry',
    'Brightline Internet',
    'Harbor Credit Union',
    'Voltbrew Soda',
    'Keystone Chairs',
  ],
  Contender: [
    'Apex Circuit Energy',
    'Lumen Peripherals',
    'Stratos Airlines',
    'Ironclad Insurance',
    'Nimbus Cloud',
    'Quantum Motors',
  ],
  Champions: [
    'Aurora Global Bank',
    'Titanforge Hardware',
    'Meridian Automotive',
    'Solace Watches',
    'Polaris Telecom',
    'Vanguard Sportswear',
  ],
}
const STARTING_PRESTIGE = 35
const RETURNING_CHAMPIONS_PRESTIGE = 58
const HISTORY_LIMIT = 5

const money = (value: number) => Math.round(value / 1000) * 1000
const random = (state: GameState) => {
  state.rng = (state.rng * 1664525 + 1013904223) >>> 0
  return state.rng / 4294967296
}
const involves = (fixture: Fixture, teamId: string) =>
  fixture.aId === teamId || fixture.bId === teamId

export function initialPrestige(teamId: string) {
  return Object.values(previousChampionsByRegion).flat().includes(teamId)
    ? RETURNING_CHAMPIONS_PRESTIGE
    : STARTING_PRESTIGE
}

/** What a team achieved in one season, read from that season's fixtures. */
export function seasonAchievements(state: GameState, teamId: string, season = state.season) {
  const own = state.fixtures.filter(
    (fixture) => fixture.season === season && involves(fixture, teamId),
  )
  const masters = [
    ...new Set(
      own
        .filter((fixture) => fixture.phase === 'Masters 1' || fixture.phase === 'Masters 2')
        .map((fixture) => fixture.phase),
    ),
  ]
  const titles = own
    .filter(
      (fixture) =>
        fixture.scope === 'international' &&
        fixture.label === 'Grand Final' &&
        fixture.status === 'completed' &&
        fixture.winnerId === teamId,
    )
    .map((fixture) => fixture.phase)
  return {
    stagePlayoffs: own.some(
      (fixture) =>
        (fixture.phase === 'Stage 1' || fixture.phase === 'Stage 2') &&
        fixture.stage === 'Playoffs',
    ),
    masters,
    champions: own.some((fixture) => fixture.phase === 'Champions'),
    championsPlayoffs: own.some(
      (fixture) => fixture.phase === 'Champions' && fixture.stage === 'Playoffs',
    ),
    titles,
  }
}

export function goalMet(state: GameState, teamId: string, goal: SponsorGoal, season: number) {
  const done = seasonAchievements(state, teamId, season)
  if (goal === 'stage-playoffs') return done.stagePlayoffs
  if (goal === 'masters') return done.masters.length > 0
  if (goal === 'champions') return done.champions
  if (goal === 'champions-playoffs') return done.championsPlayoffs
  return done.titles.length > 0
}

function summarizeSeason(state: GameState, teamId: string): SeasonSummary {
  const done = seasonAchievements(state, teamId)
  const score = Math.min(
    100,
    15 +
      (done.stagePlayoffs ? 15 : 0) +
      done.masters.length * 15 +
      (done.champions ? 20 : 0) +
      (done.championsPlayoffs ? 10 : 0) +
      done.titles.length * 25,
  )
  const best = done.titles.length
    ? `Won ${done.titles.join(' and ')}`
    : done.championsPlayoffs
      ? 'Champions playoffs'
      : done.champions
        ? 'Qualified for Champions'
        : done.masters.length
          ? `Played ${done.masters.join(' and ')}`
          : done.stagePlayoffs
            ? 'Regional playoffs'
            : 'Missed playoffs'
  return { season: state.season, score, titles: done.titles, best }
}

export function teamPrestige(team: Team) {
  return team.prestige ?? initialPrestige(team.id)
}

/**
 * Which sponsor market a team can reach. An international title in the last two seasons
 * opens Champions-level deals outright; otherwise prestige, a running average of how deep
 * the team goes each year, decides.
 */
export function sponsorLevel(team: Team): SponsorLevel {
  const prestige = teamPrestige(team)
  const recentTitle = (team.history ?? []).slice(-2).some((season) => season.titles.length)
  if (recentTitle || prestige >= 70) return 'Champions'
  if (prestige >= 45) return 'Contender'
  return 'Regional'
}

export function levelReason(team: Team) {
  const level = sponsorLevel(team)
  const last = (team.history ?? []).at(-1)
  const title = (team.history ?? [])
    .slice(-2)
    .reverse()
    .find((season) => season.titles.length)
  if (title) return `${title.season}: won ${title.titles.join(' and ')}`
  if (!last)
    return level === 'Contender' ? 'Reached Champions last year' : 'No international pedigree yet'
  return `${last.season}: ${last.best[0].toLowerCase() + last.best.slice(1)}`
}

export function makeOffers(state: GameState, team: Team, season: number): SponsorContract[] {
  const level = sponsorLevel(team)
  const names = [...sponsorNames[level]]
  return tiers.map((tier) => {
    const swing = 0.94 + random(state) * 0.12
    const [name] = names.splice(Math.floor(random(state) * names.length), 1)
    return {
      id: `sponsor-${season}-${team.id}-${tier}`,
      sponsor: name,
      season,
      tier,
      level,
      weekly: Math.round((levelValue[level] * baseScale[tier] * swing) / 52 / 100) * 100,
      bonus: money(levelValue[level] * bonusScale[tier] * swing),
      goal: goalsByLevel[level][tier],
    }
  })
}

export function payroll(state: GameState, team: Team) {
  return team.playerIds.reduce((sum, id) => sum + (state.players[id]?.salary ?? 0), 0)
}

/** AI organizations take the deal whose base best matches their payroll, leaning safe when weak. */
function aiPick(state: GameState, team: Team, offers: SponsorContract[]) {
  const weeklyPayroll = payroll(state, team) / 52
  const covering = offers.filter((offer) => offer.weekly >= weeklyPayroll * 0.9)
  if (!covering.length) return offers[2]
  return random(state) < 0.25 ? offers[1] : covering[0]
}

function sign(state: GameState, team: Team, offer: SponsorContract) {
  team.sponsor = { ...offer }
}

/** Offers for the managed team and automatic deals for everyone else. */
export function openSponsorMarket(
  state: GameState,
  season: number,
  deadline: { season: number; week: number },
) {
  Object.values(state.teams).forEach((team) => {
    const offers = makeOffers(state, team, season)
    if (team.id === state.currentTeamId) {
      state.sponsorOffers = {
        teamId: team.id,
        season,
        deadlineSeason: deadline.season,
        deadlineWeek: deadline.week,
        offers,
      }
      return
    }
    sign(state, team, aiPick(state, team, offers))
  })
}

export function pendingSponsorOffers(state: GameState) {
  const offers = state.sponsorOffers
  return offers && offers.teamId === state.currentTeamId ? offers : null
}

function acceptOffer(state: GameState, offer: SponsorContract) {
  const market = state.sponsorOffers
  if (!market) return
  const team = state.teams[market.teamId]
  sign(state, team, offer)
  state.sponsorOffers = null
  if (team.id === state.currentTeamId)
    state.inbox.unshift(
      `${team.name} signed with ${offer.sponsor}: $${offer.weekly.toLocaleString('en-US')} a week, plus $${offer.bonus.toLocaleString('en-US')} if the team can ${goalPhrase(offer.goal)} in ${offer.season}.`,
    )
}

export function signSponsor(input: GameState, offerId: string): GameState {
  const state = structuredClone(input)
  const offer = state.sponsorOffers?.offers.find((candidate) => candidate.id === offerId)
  if (offer) acceptOffer(state, offer)
  return state
}

/** Signs the medium offer when the manager lets the deadline pass. Runs before the week ends. */
export function enforceSponsorDeadline(state: GameState) {
  const market = state.sponsorOffers
  if (!market) return
  const due =
    state.season > market.deadlineSeason ||
    (state.season === market.deadlineSeason && state.week >= market.deadlineWeek)
  if (!due) return
  if (market.teamId === state.currentTeamId)
    state.inbox.unshift(
      `No sponsor was chosen before the deadline, so the board signed the medium offer from ${market.offers[1].sponsor}.`,
    )
  acceptOffer(state, market.offers[1])
}

/** Weekly sponsor base, paid in the same step as salaries. */
export function paySponsors(state: GameState) {
  Object.values(state.teams).forEach((team) => {
    if (team.sponsor) team.cash += team.sponsor.weekly
  })
}

/**
 * Runs when week 43 begins: pays bonuses for goals met this season, records the season in
 * each team's history, updates prestige, then opens next season's sponsor market.
 */
export function settleSponsorSeason(state: GameState) {
  Object.values(state.teams).forEach((team) => {
    const contract = team.sponsor
    if (contract && !contract.settled && contract.season === state.season) {
      contract.settled = true
      contract.bonusPaid = goalMet(state, team.id, contract.goal, contract.season)
      if (contract.bonusPaid) team.cash += contract.bonus
      if (team.id === state.currentTeamId)
        state.inbox.unshift(
          contract.bonusPaid
            ? `Sponsor bonus earned: ${contract.sponsor} paid $${contract.bonus.toLocaleString('en-US')} for meeting the goal (${goalPhrase(contract.goal)}).`
            : `Sponsor goal missed: ${contract.sponsor} wanted the team to ${goalPhrase(contract.goal)}. No bonus${missPenalty[contract.tier] ? `, and the organization loses ${missPenalty[contract.tier]} prestige` : ''}.`,
        )
    }
    const summary = summarizeSeason(state, team.id)
    const penalty =
      contract?.settled && contract.season === state.season && !contract.bonusPaid
        ? missPenalty[contract.tier]
        : 0
    if (penalty) summary.sponsorPenalty = penalty
    team.history = [...(team.history ?? []), summary].slice(-HISTORY_LIMIT)
    team.prestige = Math.max(
      0,
      Math.round(teamPrestige(team) * 0.5 + summary.score * 0.5) - penalty,
    )
  })
  openSponsorMarket(state, state.season + 1, { season: state.season, week: 52 })
  const market = pendingSponsorOffers(state)
  if (market)
    state.inbox.unshift(
      `Sponsor offers for ${market.season} are in (${market.offers[0].level} level). Pick one on the Finances page before week 52 or the board takes the medium deal.`,
    )
}

/** Gives a new game, or an old save, its first set of sponsor deals. */
export function seedSponsors(state: GameState) {
  Object.values(state.teams).forEach((team) => {
    team.prestige ??= initialPrestige(team.id)
    team.history ??= []
  })
  const season = state.week >= SPONSOR_SETTLE_WEEK ? state.season + 1 : state.season
  const deadline =
    state.week >= SPONSOR_SETTLE_WEEK
      ? { season: state.season, week: 52 }
      : { season: state.season, week: Math.max(state.week, 1) }
  openSponsorMarket(state, season, deadline)
}
