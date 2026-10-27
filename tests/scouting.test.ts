import { beforeEach, describe, expect, test } from 'bun:test'
import { advanceWeek, createGame, type GameState, loadGame, SAVE_KEY } from '../src/game'
import { ratingsRevealed } from '../src/player-card'
import {
  advanceScouting,
  BENCH_MORALE_PENALTY,
  ensureLadder,
  hasTrialed,
  inviteTrial,
  inviteTrialError,
  LADDER_PER_SUBREGION,
  ladderPlayers,
  negotiateTrialist,
  releaseTrialist,
  SCOUT_SUBREGIONS,
  scoutedSkillTiers,
  scoutRange,
  skillTier,
  TRIAL_FULL_ROSTER,
  TRIAL_LIMIT_OFFSEASON,
  TRIAL_LIMIT_SEASON,
  trialLimit,
  trialNeedsReplacement,
  trialsLeft,
} from '../src/scouting'
import {
  contractValue,
  freeAgents,
  playerOverall,
  renegotiateContract,
  signFreeAgent,
  signFreeAgentError,
} from '../src/transfers'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

const fresh = () => createGame('Manager', 'c9')

/** Invites a prospect, benching a current player first when the roster is full, as the screen does. */
function invite(state: GameState, playerId: string) {
  const team = state.teams[state.currentTeamId]
  const benchId = trialNeedsReplacement(state)
    ? team.playerIds.find((id) => state.players[id].status !== 'inactive')
    : undefined
  return inviteTrial(state, playerId, benchId)
}

/** A ladder prospect the managed club can scout, with its region fully scouted. */
function scoutedProspect(state: GameState) {
  const prospect = ladderPlayers(state, 'NA')[0]
  prospect.scoutProgress = 100
  return prospect
}

describe('scouting pool', () => {
  test('every subregion gets a ladder pool, and ladder players stay off the open market', () => {
    const state = fresh()
    for (const subregion of SCOUT_SUBREGIONS)
      expect(ladderPlayers(state, subregion).length).toBeGreaterThanOrEqual(LADDER_PER_SUBREGION)
    const ladderIds = new Set(ladderPlayers(state).map((player) => player.id))
    expect(freeAgents(state).some((player) => ladderIds.has(player.id))).toBe(false)
  })

  test('legacy tier 2 seeds are tagged with a subregion on load', () => {
    const legacy = fresh() as GameState & { version: number }
    for (const player of Object.values(legacy.players)) delete player.ladder
    legacy.scoutingHours = { 'tier2-0': 12, NA: 8 }
    legacy.version = 18
    localStorage.setItem(SAVE_KEY, JSON.stringify(legacy))
    const loaded = loadGame()!
    expect(loaded.players['tier2-0'].ladder?.subregion).toBe('NA')
    expect(loaded.scoutingHours).toEqual({ NA: 8 })
    for (const subregion of SCOUT_SUBREGIONS)
      expect(ladderPlayers(loaded, subregion).length).toBeGreaterThanOrEqual(LADDER_PER_SUBREGION)
  })

  test('scouting a region moves only that region forward', () => {
    const state = fresh()
    state.scoutingHours = { NA: 40 }
    const na = ladderPlayers(state, 'NA')[0]
    const emea = ladderPlayers(state, 'EMEA')[0]
    const advanced = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    expect(advanced.players[na.id].scoutProgress).toBeGreaterThan(0)
    expect(advanced.players[emea.id].scoutProgress).toBe(0)
  })

  test('the rating range always contains the true overall and narrows as scouting rises', () => {
    const state = fresh()
    const player = ladderPlayers(state, 'Asia')[0]
    const overall = playerOverall(player)
    player.scoutProgress = 0
    const wide = scoutRange(player)
    player.scoutProgress = 100
    const narrow = scoutRange(player)
    expect(wide.low).toBeLessThanOrEqual(overall)
    expect(wide.high).toBeGreaterThanOrEqual(overall)
    expect(narrow.low).toBeLessThanOrEqual(overall)
    expect(narrow.high).toBeGreaterThanOrEqual(overall)
    expect(wide.high - wide.low).toBeGreaterThan(narrow.high - narrow.low)
    expect(narrow.high - narrow.low).toBeGreaterThan(0)
  })

  test('advanceScouting raises every ladder player in the region', () => {
    const state = fresh()
    state.scoutingHours = { China: 10 }
    advanceScouting(state)
    for (const player of ladderPlayers(state, 'China'))
      expect(player.scoutProgress).toBeGreaterThan(0)
  })
})

describe('trials', () => {
  test('a prospect cannot be invited before the region is scouted enough', () => {
    const state = fresh()
    const prospect = ladderPlayers(state, 'NA')[0]
    prospect.scoutProgress = 10
    expect(inviteTrialError(state, prospect.id)).toContain('Scout')
    expect(invite(state, prospect.id).ok).toBe(false)
  })

  test('the weekly trial limit is lower in season than in the off-season', () => {
    expect(trialLimit(5)).toBe(TRIAL_LIMIT_SEASON)
    expect(trialLimit(43)).toBe(TRIAL_LIMIT_OFFSEASON)
    const state = fresh()
    state.week = 11
    const pool = ladderPlayers(state, 'NA')
    pool.forEach((player) => (player.scoutProgress = 100))
    let next = state
    for (let i = 0; i < TRIAL_LIMIT_SEASON; i++) {
      const outcome = invite(next, pool[i].id)
      expect(outcome.ok).toBe(true)
      if (outcome.ok) next = outcome.state
    }
    expect(trialsLeft(next)).toBe(0)
    expect(invite(next, pool[TRIAL_LIMIT_SEASON].id).ok).toBe(false)
    // The count resets in a new week.
    next.week = 6
    expect(trialsLeft(next)).toBe(TRIAL_LIMIT_SEASON)
  })

  test('a trial reveals exact ratings, and the prospect cannot be signed without a contract offer', () => {
    const state = fresh()
    state.week = 11
    const prospect = scoutedProspect(state)
    const outcome = invite(state, prospect.id)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(hasTrialed(outcome.state, prospect.id)).toBe(true)
    expect(signFreeAgentError(state, state.currentTeamId, prospect.id)).toContain('trial')
    expect(freeAgents(outcome.state).some((player) => player.id === prospect.id)).toBe(false)
  })

  test('offering a contract after a trial signs the player and leaves the pool', () => {
    const base = fresh()
    base.week = 11
    base.teams[base.currentTeamId].cash = 5_000_000
    const prospect = scoutedProspect(base)
    const invited = invite(base, prospect.id)
    if (!invited.ok) throw new Error(invited.error)
    const cashBefore = invited.state.teams[invited.state.currentTeamId].cash
    const offer = negotiateTrialist(invited.state, prospect.id, 2)
    expect(offer.ok).toBe(true)
    if (!offer.ok) return
    const player = offer.state.players[prospect.id]
    expect(player.teamId).toBe(offer.state.currentTeamId)
    expect(player.years).toBe(2)
    expect(player.ladder).toBeUndefined()
    expect(offer.state.trials?.[prospect.id]).toBeUndefined()
    expect(offer.state.teams[offer.state.currentTeamId].cash).toBe(
      cashBefore - contractValue({ ...player, status: 'free-agent' }),
    )
    expect(ladderPlayers(offer.state).some((p) => p.id === prospect.id)).toBe(false)
  })

  test('a contract needs a completed trial, and the length must fit the player', () => {
    const state = fresh()
    const prospect = scoutedProspect(state)
    expect(negotiateTrialist(state, prospect.id, 1).ok).toBe(false)
    state.week = 11
    const invited = invite(state, prospect.id)
    if (!invited.ok) throw new Error(invited.error)
    const tooLong = negotiateTrialist(invited.state, prospect.id, 9)
    expect(tooLong.ok).toBe(false)
  })

  test('letting a trialist go returns them to the open market', () => {
    const state = fresh()
    state.week = 11
    const prospect = scoutedProspect(state)
    const invited = invite(state, prospect.id)
    if (!invited.ok) throw new Error(invited.error)
    const released = releaseTrialist(invited.state, prospect.id)
    expect(released.ok).toBe(true)
    if (!released.ok) return
    expect(hasTrialed(released.state, prospect.id)).toBe(false)
    expect(freeAgents(released.state).some((player) => player.id === prospect.id)).toBe(true)
    expect(signFreeAgent(released.state, released.state.currentTeamId, prospect.id).ok).toBe(true)
  })

  test('ensureLadder refills a pool after prospects are signed', () => {
    const state = fresh()
    state.week = 11
    const prospect = scoutedProspect(state)
    const invited = invite(state, prospect.id)
    if (!invited.ok) throw new Error(invited.error)
    const offer = negotiateTrialist(invited.state, prospect.id, 1)
    if (!offer.ok) throw new Error(offer.error)
    expect(ladderPlayers(offer.state, 'NA').length).toBeGreaterThanOrEqual(LADDER_PER_SUBREGION)
    ensureLadder(offer.state)
    expect(ladderPlayers(offer.state, 'NA').length).toBe(LADDER_PER_SUBREGION)
  })
})

describe('player card and trials', () => {
  test('a ladder prospect shows exact ratings only after a trial', () => {
    const state = fresh()
    state.week = 11
    const prospect = scoutedProspect(state)
    expect(ratingsRevealed(state, prospect)).toBe(false)
    const invited = invite(state, prospect.id)
    if (!invited.ok) throw new Error(invited.error)
    expect(ratingsRevealed(invited.state, invited.state.players[prospect.id])).toBe(true)
  })
})

describe('trial replacements and morale', () => {
  test('a full roster must bench a current player to make way for a trial', () => {
    const state = fresh()
    state.week = 11
    const prospect = scoutedProspect(state)
    expect(trialNeedsReplacement(state)).toBe(
      state.teams[state.currentTeamId].playerIds.length >= TRIAL_FULL_ROSTER,
    )
    if (!trialNeedsReplacement(state)) return
    expect(inviteTrialError(state, prospect.id)).toContain('Choose who to bench')
    expect(inviteTrial(state, prospect.id).ok).toBe(false)
  })

  test('the benched player loses morale and is restored if the prospect is let go', () => {
    const state = fresh()
    state.week = 11
    const prospect = scoutedProspect(state)
    const benchId = state.teams[state.currentTeamId].playerIds[0]
    const benchedBefore = state.players[benchId]
    const { status, morale } = benchedBefore
    if (!trialNeedsReplacement(state)) return
    const invited = inviteTrial(state, prospect.id, benchId)
    if (!invited.ok) throw new Error(invited.error)
    expect(invited.state.players[benchId].status).toBe('inactive')
    expect(invited.state.players[benchId].morale).toBe(Math.max(5, morale - BENCH_MORALE_PENALTY))
    const released = releaseTrialist(invited.state, prospect.id)
    if (!released.ok) throw new Error(released.error)
    expect(released.state.players[benchId].status).toBe(status)
    expect(released.state.players[benchId].morale).toBe(morale)
  })

  test('a benched player with low morale will not re-sign', () => {
    const state = fresh()
    state.week = 43
    const player = state.players[state.teams[state.currentTeamId].playerIds[0]]
    player.years = 1
    player.morale = 30
    const refused = renegotiateContract(state, player.id, 1)
    expect(refused.ok).toBe(false)
    player.morale = 60
    expect(renegotiateContract(state, player.id, 1).ok).toBe(true)
  })

  test('skill tiers stay general and only show once the region is partly scouted', () => {
    const state = fresh()
    const prospect = ladderPlayers(state, 'Asia')[0]
    prospect.scoutProgress = 0
    expect(scoutedSkillTiers(prospect)).toBeNull()
    prospect.scoutProgress = 50
    const tiers = scoutedSkillTiers(prospect)
    expect(
      tiers?.every((entry) => ['Elite', 'Strong', 'Solid', 'Developing'].includes(entry.tier)),
    ).toBe(true)
    expect(skillTier(85)).toBe('Elite')
    expect(skillTier(40)).toBe('Developing')
  })

  test('each region keeps a pool of dozens of prospects', () => {
    const state = fresh()
    for (const subregion of SCOUT_SUBREGIONS)
      expect(ladderPlayers(state, subregion).length).toBeGreaterThanOrEqual(20)
  })
})
