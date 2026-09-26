import { describe, expect, test } from 'bun:test'
import {
  advanceWeek,
  createGame,
  type GameState,
  kickoffStandings,
  loadGame,
  phaseForWeek,
  regionalPlayoffOrder,
  SAVE_KEY,
  stageGroups,
  stagePlayoffSeeds,
} from '../src/game'
import type { Region } from '../src/seed'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    setItem: (key: string, value: string) => memory.set(key, value),
    getItem: (key: string) => memory.get(key) ?? null,
    removeItem: (key: string) => memory.delete(key),
  },
})

const regions: Region[] = ['Americas', 'EMEA', 'Pacific', 'China']
const snapshots = new Map<number, GameState>()
let state = createGame('Stage groups', 'sen')
for (let week = 1; week <= 31; week++) {
  state = advanceWeek(state, 'Measured defaults', 'Disciplined retakes')
  snapshots.set(state.week, structuredClone(state))
}
const at = (week: number) => snapshots.get(week)!

const groupGames = (s: GameState, phase: 'Stage 1' | 'Stage 2', teamId: string) =>
  s.fixtures.filter(
    (fixture) =>
      fixture.season === s.season &&
      fixture.phase === phase &&
      fixture.stage === 'League' &&
      (fixture.aId === teamId || fixture.bId === teamId),
  )

describe('Stage group format', () => {
  test('group stages run five weeks and playoffs follow straight after', () => {
    expect(phaseForWeek(11)).toBe('Stage 1')
    expect(phaseForWeek(16)).toBe('Stage 1')
    expect(phaseForWeek(24)).toBe('Stage 2')
    expect(phaseForWeek(29)).toBe('Stage 2')
    expect(phaseForWeek(32)).toBe('Break')
  })

  for (const [phase, done] of [
    ['Stage 1', 16],
    ['Stage 2', 29],
  ] as const) {
    test(`every team plays exactly five group games in ${phase}`, () => {
      const s = at(done)
      Object.values(s.teams).forEach((team) => {
        const games = groupGames(s, phase, team.id)
        expect(games).toHaveLength(5)
        expect(games.every((fixture) => fixture.status === 'completed')).toBeTrue()
        const group = games[0].group
        const opponents = games.map((fixture) =>
          fixture.aId === team.id ? fixture.bId : fixture.aId,
        )
        expect(new Set(opponents).size).toBe(5)
        expect(games.every((fixture) => fixture.group === group)).toBeTrue()
        expect(
          opponents.every((id) => s.teams[id!].region === team.region && id !== team.id),
        ).toBeTrue()
      })
      // Each team plays once per week.
      for (let week = done - 5; week < done; week++) {
        const ids = s.fixtures
          .filter((f) => f.phase === phase && f.stage === 'League' && f.week === week)
          .flatMap((f) => [f.aId, f.bId])
        expect(ids).toHaveLength(48)
        expect(new Set(ids).size).toBe(48)
      }
    })
  }

  test('Stage 1 groups split each pair of Kickoff seeds', () => {
    const before = at(11)
    regions.forEach((region) => {
      const seeding = kickoffStandings(before, region)
      const groups = stageGroups(before, 'Stage 1', region)!
      expect(groups.A).toHaveLength(6)
      expect(groups.B).toHaveLength(6)
      for (let tier = 0; tier < 6; tier++) {
        const pair = seeding.slice(tier * 2, tier * 2 + 2)
        expect(pair.filter((id) => groups.A.includes(id))).toHaveLength(1)
        expect(pair.filter((id) => groups.B.includes(id))).toHaveLength(1)
      }
      // The three Masters 1 qualifiers finish top three.
      expect(
        seeding.slice(0, 3).every((id) => before.kickoff[id].status === 'qualified'),
      ).toBeTrue()
    })
  })

  test('Stage 2 groups split each pair of Stage 1 finishers', () => {
    const before = at(24)
    regions.forEach((region) => {
      const seeding = regionalPlayoffOrder(before, 'Stage 1', region)
      const groups = stageGroups(before, 'Stage 2', region)!
      expect(seeding).toHaveLength(12)
      for (let tier = 0; tier < 6; tier++) {
        const pair = seeding.slice(tier * 2, tier * 2 + 2)
        expect(pair.filter((id) => groups.A.includes(id))).toHaveLength(1)
        expect(pair.filter((id) => groups.B.includes(id))).toHaveLength(1)
      }
    })
  })

  test('the top four of each group reach cross-group playoff seeds', () => {
    for (const [phase, week] of [
      ['Stage 1', 16],
      ['Stage 2', 29],
    ] as const) {
      const s = at(week)
      regions.forEach((region) => {
        const groups = stageGroups(s, phase, region)!
        const seeds = stagePlayoffSeeds(s, phase, region)
        expect(seeds).toHaveLength(8)
        expect(seeds.filter((id) => groups.A.includes(id))).toHaveLength(4)
        const quarters = s.fixtures.filter(
          (f) => f.phase === phase && f.region === region && f.label === 'Upper Quarterfinal',
        )
        expect(quarters).toHaveLength(2)
        quarters.forEach((fixture) => {
          expect(groups.A.includes(fixture.aId)).not.toBe(groups.A.includes(fixture.bId!))
        })
      })
    }
  })

  test('a legacy save in the middle of Stage 1 restarts on the group format', () => {
    const clean = at(11)
    const legacy = structuredClone(at(13)) as any
    legacy.version = 11
    localStorage.setItem(SAVE_KEY, JSON.stringify(legacy))
    const migrated = loadGame()!
    expect(migrated.version).toBe(12)
    expect(migrated.week).toBe(11)
    expect(
      migrated.fixtures.filter((f) => f.phase === 'Stage 1' && f.status === 'completed'),
    ).toHaveLength(0)
    Object.values(migrated.teams).forEach((team) => {
      expect(team.wins).toBe(clean.teams[team.id].wins)
      expect(team.championshipPoints).toBe(clean.teams[team.id].championshipPoints)
      expect(groupGames(migrated, 'Stage 1', team.id)).toHaveLength(5)
    })
  })

  test('a legacy save in Stage 2 playoffs restarts because those weeks moved', () => {
    const legacy = structuredClone(at(30)) as any
    legacy.version = 11
    localStorage.setItem(SAVE_KEY, JSON.stringify(legacy))
    const migrated = loadGame()!
    expect(migrated.week).toBe(24)
    Object.values(migrated.teams).forEach((team) => {
      expect(groupGames(migrated, 'Stage 2', team.id)).toHaveLength(5)
    })
  })
})
