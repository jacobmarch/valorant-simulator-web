import { beforeEach, describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { CompetitionV2 } from '../src/competition-view'
import { advanceWeek, createGame, simulateNextTournamentMatch } from '../src/game'
import { MatchesV2 } from '../src/game-views'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})
beforeEach(() => memory.clear())

describe('competition center', () => {
  test('Kickoff renders its three lives as named bracket lanes', () => {
    const html = renderToStaticMarkup(<CompetitionV2 s={createGame('Manager', 'sen')} />)
    expect(html).toContain('Upper bracket')
    expect(html).toContain('Middle bracket')
    expect(html).toContain('Lower bracket')
    expect(html).toContain('Three qualifiers')
    expect(html).toContain('Kickoff standings')
    expect(html).toContain('Play next match')
    expect(html).toContain('Simulate round')
    expect((html.match(/class="kickoff-round-track"/g) ?? []).length).toBe(15)
    expect((html.match(/class="kickoff-merge-connector"/g) ?? []).length).toBeGreaterThan(0)
    expect((html.match(/class="kickoff-out-connector"/g) ?? []).length).toBeGreaterThan(0)
    expect((html.match(/class="kickoff-out-connector is-half"/g) ?? []).length).toBeGreaterThan(0)
    expect((html.match(/class="kickoff-join-connector"/g) ?? []).length).toBeGreaterThan(0)
    expect((html.match(/placeholder-node/g) ?? []).length).toBeGreaterThan(1)
    expect(html).toContain('matchup-teams')
    expect(html).toContain('kickoff-bracket-rounds slots-4')
    expect(html).toContain('kickoff-bracket-rounds slots-2')
    expect(html).not.toMatch(/kickoff-round-track"[^>]*--slots/)
    expect(html).toContain('Upper Round 3')
    expect(html).toContain('Upper Final')
  })
  test('Masters opens on a Swiss view with direct regional seeds', () => {
    let state = createGame('Manager', 'sen')
    for (let week = 0; week < 7; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const html = renderToStaticMarkup(<CompetitionV2 s={state} />)
    expect(html).toContain('Swiss stage')
    expect(html).toContain('Regional champions')
    expect(html).toContain('Two wins advance. Two losses eliminate.')
    expect(html).toContain('Masters 1 · current matchups')
    expect(html).toContain('SWISS RESULTS')
    expect(html).toContain('Stage games played')
    expect(html).toContain('Opening')
  })
  test('Masters playoff match desk keeps completed series until the round ends', {
    timeout: 15000,
  }, () => {
    let state = createGame('Manager', 'sen')
    for (let week = 0; week < 9; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    state = simulateNextTournamentMatch(
      state,
      'Measured defaults',
      'Disciplined retakes',
      'Masters 1',
    )
    const midRound = renderToStaticMarkup(<CompetitionV2 s={state} />)
    const midDesk = midRound.slice(midRound.indexOf('Masters 1 · current matchups'))
    expect((midDesk.match(/Upper Quarterfinal/g) ?? []).length).toBe(4)
    expect(midDesk).toContain('Final')
    expect(midDesk).toContain('Week 10 · BO')
    expect(midDesk).not.toContain('Upper Semifinal')
    for (let index = 0; index < 3; index++)
      state = simulateNextTournamentMatch(
        state,
        'Measured defaults',
        'Disciplined retakes',
        'Masters 1',
      )
    const nextRound = renderToStaticMarkup(<CompetitionV2 s={state} />)
    expect(nextRound).toContain('Upper Semifinal')
    expect(nextRound).toContain('Lower Round 1')
    const desk = nextRound.slice(nextRound.indexOf('Masters 1 · current matchups'))
    expect(desk).not.toContain('Upper Quarterfinal')
  })
  test('Masters Swiss results remain visible after the stage is played', { timeout: 15000 }, () => {
    let state = createGame('Manager', 'sen')
    for (let week = 0; week < 8; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const html = renderToStaticMarkup(<CompetitionV2 s={state} />)
    expect(html).toContain('SWISS RESULTS')
    expect(html).toContain('Advancement')
    expect(html).toContain('Elimination')
    expect((html.match(/class="swiss-result-round"/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
  test('a completed season exposes the upper, lower, and title paths', { timeout: 10000 }, () => {
    let state = createGame('Manager', 'sen')
    for (let week = 0; week < 43; week++)
      state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const html = renderToStaticMarkup(<CompetitionV2 s={state} />)
    expect(html).toContain('Upper bracket')
    expect(html).toContain('Lower bracket')
    expect(html).toContain('Grand final')
    expect(html).toContain('TITLE MATCH')
  })
  test('background match results are available in the reusable broadcast view', () => {
    let state = createGame('Manager', 'sen')
    state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
    const background = state.matches.find((match) => {
      const a = state.teams[match.aId],
        b = state.teams[match.bId]
      return a.region === 'Americas' && a.id !== state.currentTeamId && b.id !== state.currentTeamId
    })!
    const viewState = structuredClone(state)
    viewState.week = 1
    const broadcast = renderToStaticMarkup(<MatchesV2 s={state} initialMatchId={background.id} />)
    expect(broadcast).toContain(`value="${background.id}"`)
    expect(broadcast).toContain(state.teams[background.aId].name)
    expect(broadcast).toContain(state.teams[background.bId].name)
    expect((broadcast.match(/<option/g) ?? []).length).toBe(state.matches.length)
    const competition = renderToStaticMarkup(<CompetitionV2 s={viewState} onOpenMatch={() => {}} />)
    expect((competition.match(/role="button"/g) ?? []).length).toBeGreaterThan(0)
  })
})
