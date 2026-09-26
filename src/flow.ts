// UI-side helpers for moving through the calendar: what the Continue button does next,
// what the manager should look at before pressing it, and what changed afterwards.
import {
  currentTeam,
  fixturesForWeek,
  isInternationalPhase,
  phaseForWeek,
  playableTournamentFixtureIds,
  teamPlayers,
  type Fixture,
  type GameState,
  type MatchResult,
} from './game'
import { skills } from './seed'
import { MAX_ROSTER, transferWindowForWeek } from './transfers'
import type { View } from './ui'

export const TRAINING_HOURS = 40
export const SCOUTING_HOURS = 40

/** Weeks where the calendar is played one bracket round at a time. */
export function isRoundWeek(s: GameState) {
  const phase = phaseForWeek(s.week)
  return (
    phase === 'Kickoff' ||
    isInternationalPhase(phase) ||
    (phase === 'Stage 1' && s.week >= 16) ||
    (phase === 'Stage 2' && s.week >= 32)
  )
}

const involves = (fixture: Fixture | MatchResult, teamId: string) =>
  fixture.aId === teamId || fixture.bId === teamId

export type NextAction = {
  mode: 'round' | 'week'
  label: string
  detail: string
  /** The managed team's fixture in this step, when there is one. */
  fixture?: Fixture
}

export function nextAction(s: GameState): NextAction {
  const team = currentTeam(s)
  const opponentShort = (fixture: Fixture) =>
    s.teams[fixture.aId === team.id ? (fixture.bId ?? '') : fixture.aId]?.short ?? 'TBD'
  if (isRoundWeek(s)) {
    const ids = new Set(playableTournamentFixtureIds(s))
    const step = s.fixtures.filter((fixture) => ids.has(fixture.id))
    const own = step.find((fixture) => involves(fixture, team.id))
    const labels = [...new Set(step.map((fixture) => fixture.label))]
    if (own)
      return {
        mode: 'round',
        label: `Play ${opponentShort(own)}`,
        detail: `${own.phase} · ${own.label} · Bo${own.bestOf}`,
        fixture: own,
      }
    return {
      mode: 'round',
      label: labels.length ? `Sim ${labels[0]}` : 'Continue',
      detail: labels.length
        ? `${step.length} series · ${phaseForWeek(s.week)}`
        : `Finish week ${s.week}`,
    }
  }
  const own = fixturesForWeek(s).find(
    (fixture) => fixture.status === 'scheduled' && involves(fixture, team.id),
  )
  if (own)
    return {
      mode: 'week',
      label: `Play ${opponentShort(own)}`,
      detail: `Week ${s.week} · ${own.label} · Bo${own.bestOf}`,
      fixture: own,
    }
  return {
    mode: 'week',
    label: `Go to week ${s.week + 1 > 52 ? 1 : s.week + 1}`,
    detail: phaseForWeek(s.week) === 'Break' ? 'Calendar break' : 'No series for you this week',
  }
}

export type AttentionItem = {
  id: string
  level: 'urgent' | 'warn' | 'info'
  title: string
  detail: string
  view: View
}

export function trainingGaps(s: GameState) {
  return teamPlayers(s).filter((player) => {
    const plan = s.training[player.id] ?? {}
    return skills.reduce((sum, skill) => sum + (plan[skill] ?? 0), 0) < TRAINING_HOURS
  })
}

/** Manager to-do list: things that quietly cost you if nobody looks at them. */
export function attentionItems(s: GameState): AttentionItem[] {
  const team = currentTeam(s)
  const players = teamPlayers(s)
  const items: AttentionItem[] = []
  if (team.lineup.length < 5)
    items.push({
      id: 'lineup',
      level: 'urgent',
      title: `Only ${team.lineup.length} of 5 starters set`,
      detail: 'Promote a substitute or sign a player before the next series.',
      view: 'roster',
    })
  const gaps = trainingGaps(s)
  if (gaps.length)
    items.push({
      id: 'training',
      level: gaps.length === players.length ? 'urgent' : 'warn',
      title: `${gaps.length} ${gaps.length === 1 ? 'player has' : 'players have'} unused training hours`,
      detail: 'Skills under 5 hours a week can drop. One click applies a balanced plan.',
      view: 'training',
    })
  const window = transferWindowForWeek(s.week)
  if (window)
    items.push({
      id: 'window',
      level: 'info',
      title: `${window.label} is open`,
      detail: `Sign, buy out, or release players through week ${window.end}. ${players.length}/${MAX_ROSTER} on the roster.`,
      view: 'roster',
    })
  const expiring = players.filter((player) => player.years <= 1)
  if (expiring.length && s.week >= 36)
    items.push({
      id: 'contracts',
      level: 'warn',
      title: `${expiring.length} contract${expiring.length === 1 ? '' : 's'} expiring`,
      detail: expiring.map((player) => player.name).join(', '),
      view: 'roster',
    })
  const scouting = Object.values(s.scoutingHours).reduce((sum, hours) => sum + hours, 0)
  if (scouting < SCOUTING_HOURS)
    items.push({
      id: 'scouting',
      level: 'info',
      title: `${SCOUTING_HOURS - scouting} scouting hours unassigned`,
      detail: 'Point scouts at targets to reveal their ratings.',
      view: 'scouting',
    })
  return items
}

export type ContinueReport = {
  week: number
  managed: MatchResult[]
  others: number
}

/** What a Continue press produced, for the result banner. */
export function continueReport(before: GameState, after: GameState): ContinueReport {
  const seen = new Set(before.matches.map((match) => match.id))
  const fresh = after.matches.filter((match) => !seen.has(match.id))
  const managed = fresh.filter((match) => involves(match, after.currentTeamId))
  return { week: after.week, managed, others: fresh.length - managed.length }
}
