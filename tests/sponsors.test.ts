import { beforeEach, describe, expect, test } from 'bun:test'
import { advanceWeek, createGame, loadGame, SAVE_KEY, type GameState } from '../src/game'
import { attentionItems } from '../src/flow'
import {
  enforceSponsorDeadline,
  pendingSponsorOffers,
  settleSponsorSeason,
  signSponsor,
  sponsorLevel,
} from '../src/sponsors'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

const addFixture = (state: GameState, teamId: string, extra: Partial<GameState['fixtures'][0]>) =>
  state.fixtures.push({
    id: `test-${state.fixtures.length}`,
    season: state.season,
    week: 40,
    phase: 'Champions',
    scope: 'international',
    round: 1,
    label: 'Group',
    aId: teamId,
    bId: 'fnc',
    bestOf: 3,
    status: 'completed',
    winnerId: teamId,
    ...extra,
  })

describe('sponsors', () => {
  test('a new game offers the manager three tiers and signs every AI team', () => {
    const state = createGame('Manager', 'c9')
    const market = pendingSponsorOffers(state)!
    expect(market.offers.map((offer) => offer.tier)).toEqual(['easy', 'medium', 'high'])
    expect(market.offers[0].weekly).toBeLessThan(market.offers[2].weekly)
    expect(market.offers[0].bonus).toBeLessThan(market.offers[2].bonus)
    expect(state.teams.c9.sponsor).toBeUndefined()
    Object.values(state.teams)
      .filter((team) => team.id !== 'c9')
      .forEach((team) => expect(team.sponsor?.weekly).toBeGreaterThan(0))
    expect(attentionItems(state).some((item) => item.id === 'sponsor')).toBeTrue()
  })

  test('signing pays the weekly base alongside salaries', () => {
    const offered = createGame('Manager', 'c9')
    const offer = pendingSponsorOffers(offered)!.offers[2]
    const state = signSponsor(offered, offer.id)
    expect(state.teams.c9.sponsor?.id).toBe(offer.id)
    expect(pendingSponsorOffers(state)).toBeNull()
    const payroll = state.teams.c9.playerIds.reduce((sum, id) => sum + state.players[id].salary, 0)
    const before = state.teams.c9.cash
    const next = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const matchMoney = next.matches.some(
      (match) => match.week === 1 && (match.aId === 'c9' || match.bId === 'c9'),
    )
    const delta = next.teams.c9.cash - before
    const expected = offer.weekly - payroll / 52
    expect(delta - expected).toBeGreaterThanOrEqual(0)
    expect(delta - expected).toBeLessThanOrEqual(matchMoney ? 25000 : 0)
  })

  test('the board signs the medium deal when the deadline passes', () => {
    const state = createGame('Manager', 'c9')
    const medium = pendingSponsorOffers(state)!.offers[1]
    enforceSponsorDeadline(state)
    expect(state.teams.c9.sponsor?.id).toBe(medium.id)
    expect(state.sponsorOffers).toBeNull()
  })

  test('the bonus pays only when the goal is met, then next season offers open', () => {
    const state = createGame('Manager', 'c9')
    const offers = pendingSponsorOffers(state)!.offers
    state.teams.c9.sponsor = { ...offers[0] }
    state.teams.sen.sponsor = { ...offers[0], goal: 'international-title' }
    addFixture(state, 'c9', { phase: 'Stage 1', scope: 'regional', stage: 'Playoffs' })
    const [c9Cash, senCash] = [state.teams.c9.cash, state.teams.sen.cash]
    state.week = 43
    settleSponsorSeason(state)
    expect(state.teams.c9.cash - c9Cash).toBe(offers[0].bonus)
    expect(state.teams.sen.cash).toBe(senCash)
    expect(state.teams.c9.sponsor?.bonusPaid).toBeTrue()
    expect(pendingSponsorOffers(state)?.season).toBe(2027)
    expect(pendingSponsorOffers(state)?.deadlineWeek).toBe(52)
    settleSponsorSeason(state)
    expect(state.teams.c9.cash - c9Cash).toBe(offers[0].bonus)
  })

  test('an international title opens Champions-level offers; a weak season does not', () => {
    const state = createGame('Manager', 'c9')
    addFixture(state, 'c9', { phase: 'Masters 1', label: 'Grand Final', stage: 'Playoffs' })
    state.week = 43
    settleSponsorSeason(state)
    expect(sponsorLevel(state.teams.c9)).toBe('Champions')
    expect(pendingSponsorOffers(state)!.offers[2].goal).toBe('international-title')
    expect(sponsorLevel(state.teams.nrg)).toBe('Regional')
    const champion = pendingSponsorOffers(state)!.offers[1].weekly
    const regional = state.teams.nrg.sponsor!
    expect(champion).toBeGreaterThan(regional.weekly)
  })

  test('version 12 saves gain sponsors on load', () => {
    const legacy = createGame('Manager', 'c9') as any
    legacy.version = 12
    delete legacy.sponsorOffers
    Object.values(legacy.teams).forEach((team: any) => {
      delete team.sponsor
      delete team.prestige
      delete team.history
    })
    memory.set(SAVE_KEY, JSON.stringify(legacy))
    const loaded = loadGame()!
    expect(loaded.version).toBe(13)
    expect(pendingSponsorOffers(loaded)?.offers).toHaveLength(3)
    expect(loaded.teams.sen.sponsor?.weekly).toBeGreaterThan(0)
    expect(loaded.teams.sen.prestige).toBeGreaterThan(loaded.teams.nrg.prestige!)
  })
})
