import { maps, roles, seedTeams, skills, tier2Targets, type Region, type Role } from './seed'

export type Skill = typeof skills[number]
export type DelegationMode = 'hands-on' | 'balanced' | 'hands-off'
export type PlayerStatus = 'starter' | 'substitute' | 'inactive' | 'free-agent'

export type Ratings = Record<Skill, number>
export type Player = {
  id: string; name: string; teamId: string | null; region: Region | null; primaryRole: Role; secondaryRoles: Role[]
  ratings: Ratings; salary: number; years: number; status: PlayerStatus; isImport: boolean; scoutProgress: number; form: number
}
export type Team = {
  id: string; name: string; short: string; region: Region; color: string; playerIds: string[]; lineup: string[]; roleAssignments: Record<string, Role>
  cash: number; salaryBudget: number; wins: number; losses: number; mapWins: number; mapLosses: number; championshipPoints: number; playoffStage: string
}
export type PlayerStat = { kills: number; deaths: number; assists: number; acs: number; adr: number; kast: number; firstKills: number; firstDeaths: number; clutches: number; plants: number; defuses: number; headshots: number }
export type MapResult = { map: string; aScore: number; bScore: number; winnerId: string; rounds: string[]; stats: Record<string, PlayerStat> }
export type MatchResult = { id: string; week: number; phase: string; aId: string; bId: string; bestOf: 3 | 5; winnerId: string; aScore: number; bScore: number; maps: MapResult[]; highlights: string[]; veto: string[]; attackStyle: string; defenseStyle: string }
export type JobOffer = { id: string; teamId: string; expiresWeek: number; reason: string; salary: number; status: 'pending' | 'accepted' | 'declined' }
export type GameState = {
  version: 1; season: number; week: number; managerName: string; currentTeamId: string; teams: Record<string, Team>; players: Record<string, Player>
  matches: MatchResult[]; inbox: string[]; jobs: JobOffer[]; training: Record<string, Partial<Record<Skill, number>>>; scoutingHours: Record<string, number>
  settings: Record<string, DelegationMode | boolean>; rng: number; saveTimestamp: string
}

const SAVE_KEY = 'vct-manager-mvp-save-v1'
const roleFor = (index: number): Role => roles[index % roles.length]
const emptyRatings = (base: number): Ratings => ({ Mechanics: base, Tactics: base - 2, Utility: base - 3, Consistency: base - 1, Clutch: base - 4, Teamplay: base - 2 })
const next = (state: GameState) => { state.rng = (state.rng * 1664525 + 1013904223) >>> 0; return state.rng / 4294967296 }
const money = (value: number) => Math.round(value / 1000) * 1000

export function createGame(managerName: string, currentTeamId: string): GameState {
  const players: Record<string, Player> = {}
  const teams: Record<string, Team> = {}
  seedTeams.forEach((seed, teamIndex) => {
    const playerIds = seed.players.map((name, playerIndex) => {
      const id = `${seed.id}-${playerIndex}`
      const base = Math.max(58, Math.min(88, 68 + ((teamIndex * 7 + playerIndex * 3) % 18)))
      const primaryRole = roleFor(playerIndex)
      players[id] = { id, name, teamId: seed.id, region: seed.region, primaryRole, secondaryRoles: playerIndex === 4 ? roles.filter((role) => role !== primaryRole).slice(0, 2) : playerIndex === 2 ? [roles[(playerIndex + 1) % roles.length]] : [], ratings: emptyRatings(base), salary: money(55000 + base * 1400), years: 1 + (playerIndex % 3), status: playerIndex < 5 ? 'starter' : 'substitute', isImport: playerIndex === 0 && teamIndex % 5 === 0, scoutProgress: 100, form: 0 }
      return id
    })
    const lineup = playerIds.slice(0, 5)
    teams[seed.id] = { id: seed.id, name: seed.name, short: seed.short, region: seed.region, color: seed.color, playerIds, lineup, roleAssignments: Object.fromEntries(lineup.map((id) => [id, players[id].primaryRole])), cash: 1000000 + (12 - teamIndex % 12) * 50000, salaryBudget: 800000, wins: 0, losses: 0, mapWins: 0, mapLosses: 0, championshipPoints: 0, playoffStage: 'Regular Season' }
  })
  tier2Targets.forEach((name, index) => {
    const id = `tier2-${index}`
    players[id] = { id, name: ['N4RRATE', 'johnqt', 'rhyme', 'Tixx', 'Jex'][index] ?? `Prospect ${index + 1}`, teamId: null, region: null, primaryRole: roleFor(index + 1), secondaryRoles: [], ratings: emptyRatings(62 + index * 2), salary: 35000 + index * 4000, years: 1, status: 'free-agent', isImport: false, scoutProgress: 0, form: 0 }
  })
  return { version: 1, season: 2026, week: 1, managerName: managerName || 'Manager', currentTeamId, teams, players, matches: [], inbox: ['Welcome to the 2026 VCT season. Review your roster and prepare for Kickoff.'], jobs: [], training: {}, scoutingHours: {}, settings: { roster: 'hands-on', training: 'hands-on', scouting: 'hands-on', finances: 'balanced', sponsorships: false, personalities: false }, rng: 20260201, saveTimestamp: new Date().toISOString() }
}

export function saveGame(state: GameState) { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, saveTimestamp: new Date().toISOString() })) }
export function loadGame(): GameState | null { try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) as GameState : null } catch { return null } }
export function resetGame() { localStorage.removeItem(SAVE_KEY) }
export function currentTeam(state: GameState) { return state.teams[state.currentTeamId] }
export function teamPlayers(state: GameState, teamId = state.currentTeamId) { return state.teams[teamId].playerIds.map((id) => state.players[id]).filter(Boolean) }
export function phaseForWeek(week: number) { if (week <= 6) return 'Kickoff'; if (week <= 10) return 'Masters 1'; if (week <= 18) return 'Stage 1'; if (week <= 22) return 'Masters 2'; if (week <= 34) return 'Stage 2'; if (week <= 42) return 'Champions'; return 'Offseason' }
export function phaseLabel(week: number) { const phase = phaseForWeek(week); return phase === 'Masters 1' ? 'Masters Santiago' : phase === 'Masters 2' ? 'Masters London' : phase === 'Champions' ? 'Champions Shanghai' : phase }
export function dateForWeek(week: number) { const date = new Date(2026, 0, 1); date.setDate(date.getDate() + (week - 1) * 7); return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
export function buyout(player: Player) { return money(player.salary * player.years) }
export function teamStrength(state: GameState, teamId: string) { const team = state.teams[teamId]; const players = team.lineup.map((id) => state.players[id]).filter(Boolean); if (!players.length) return 45; return players.reduce((sum, player) => sum + Object.values(player.ratings).reduce((a, b) => a + b, 0) / 6 + player.form, 0) / players.length }
function roleFit(player: Player, role: Role) { return player.primaryRole === role || player.secondaryRoles.includes(role) || player.primaryRole === 'Flex' ? 1 : 0.86 }
function playerStat(state: GameState, player: Player, rounds: number, rating: number): PlayerStat { const volume = rating / 100; const kills = Math.max(3, Math.round(rounds * (0.45 + volume * 0.3) + next(state) * 5)); const deaths = Math.max(3, Math.round(rounds * (0.45 - volume * 0.12) + next(state) * 4)); return { kills, deaths, assists: Math.round(kills * 0.24 + next(state) * 5), acs: Math.round(150 + rating * 2.6 + next(state) * 40), adr: Math.round(110 + rating * 1.4 + next(state) * 25), kast: Math.round(63 + rating * 0.25), firstKills: Math.round(kills * 0.16), firstDeaths: Math.round(deaths * 0.13), clutches: Math.floor(next(state) * 3), plants: Math.floor(next(state) * 4), defuses: Math.floor(next(state) * 2), headshots: Math.round(kills * (0.22 + next(state) * 0.2)) } }
function simulateMap(state: GameState, aId: string, bId: string, map: string, attackStyle: string, defenseStyle: string): MapResult {
  const a = state.teams[aId]; const b = state.teams[bId]; const aPower = teamStrength(state, aId); const bPower = teamStrength(state, bId); const aStyle = attackStyle === 'Fast and explosive' ? 2 : defenseStyle === 'Disciplined retakes' ? 1 : 0; const bStyle = defenseStyle === 'Disciplined retakes' ? 2 : 0; let aScore = 0; let bScore = 0; let round = 0; const rounds: string[] = []
  while (round < 42 && (aScore < 13 && bScore < 13)) { round++; const sideBonus = round <= 12 ? (round % 2 ? 1.5 : -1.5) : (round % 2 ? -1.5 : 1.5); const probability = Math.max(0.12, Math.min(0.88, 0.5 + (aPower - bPower) / 100 + (aStyle - bStyle) / 100 + sideBonus / 100 + (next(state) - 0.5) / 5)); const aWins = next(state) < probability; if (aWins) aScore++; else bScore++; rounds.push(`${aWins ? a.short : b.short} win round ${round}`) }
  if (aScore === 12 && bScore === 12) { let otA = 0; let otB = 0; while (Math.abs(otA - otB) < 2 && otA + otB < 14) { const aWins = next(state) < Math.max(0.2, Math.min(0.8, 0.5 + (aPower - bPower) / 100)); aWins ? otA++ : otB++; rounds.push(`OT: ${aWins ? a.short : b.short}`) } aScore += otA; bScore += otB }
  const winnerId = aScore > bScore ? aId : bId; const stats: Record<string, PlayerStat> = {}; const totalRounds = aScore + bScore; a.lineup.forEach((id) => { const p = state.players[id]; stats[id] = playerStat(state, p, totalRounds, teamStrength(state, aId) * roleFit(p, a.roleAssignments[id] ?? p.primaryRole) / 1.1) }); b.lineup.forEach((id) => { const p = state.players[id]; stats[id] = playerStat(state, p, totalRounds, teamStrength(state, bId) * roleFit(p, b.roleAssignments[id] ?? p.primaryRole) / 1.1) }); return { map, aScore, bScore, winnerId, rounds, stats }
}
export function simulateSeries(state: GameState, aId: string, bId: string, week: number, attackStyle = 'Measured defaults', defenseStyle = 'Disciplined retakes'): MatchResult {
  const phase = phaseForWeek(week); const bestOf: 3 | 5 = phase.includes('Final') || phase === 'Champions' ? 5 : 3; const mapCount = bestOf === 5 ? 5 : 3; const veto = maps.slice(0, mapCount); const mapResults: MapResult[] = []; let aWins = 0; let bWins = 0; let mapIndex = 0; while (aWins < Math.ceil(bestOf / 2) && bWins < Math.ceil(bestOf / 2)) { const result = simulateMap(state, aId, bId, veto[mapIndex % veto.length], attackStyle, defenseStyle); mapResults.push(result); result.winnerId === aId ? aWins++ : bWins++; mapIndex++ }
  const winnerId = aWins > bWins ? aId : bId; const a = state.teams[aId]; const b = state.teams[bId]; a.wins += winnerId === aId ? 1 : 0; a.losses += winnerId === aId ? 0 : 1; b.wins += winnerId === bId ? 1 : 0; b.losses += winnerId === bId ? 0 : 1; a.mapWins += mapResults.filter((m) => m.winnerId === aId).length; a.mapLosses += mapResults.filter((m) => m.winnerId !== aId).length; b.mapWins += mapResults.filter((m) => m.winnerId === bId).length; b.mapLosses += mapResults.filter((m) => m.winnerId !== bId).length; if (winnerId === aId) a.championshipPoints += 1; else b.championshipPoints += 1
  const highlights = [`${state.players[a.lineup[0]].name} opened the series with a first blood streak`, `${state.players[(winnerId === aId ? a : b).lineup[0]].name} delivered a match-leading performance`, `${mapResults[0].map} ended ${mapResults[0].aScore}-${mapResults[0].bScore}`]; return { id: `${week}-${aId}-${bId}-${state.matches.length}`, week, phase: phaseLabel(week), aId, bId, bestOf, winnerId, aScore: aWins, bScore: bWins, maps: mapResults, highlights, veto, attackStyle, defenseStyle }
}
function opponentFor(state: GameState, teamId: string) { const team = state.teams[teamId]; const candidates = Object.values(state.teams).filter((other) => other.id !== teamId && other.region === team.region); return candidates[Math.floor(next(state) * candidates.length)] ?? Object.values(state.teams).find((other) => other.id !== teamId)! }
export function advanceWeek(input: GameState, attackStyle: string, defenseStyle: string): GameState {
  const state: GameState = structuredClone(input); const phase = phaseForWeek(state.week); const current = currentTeam(state); const assignments = state.training
  Object.values(state.players).forEach((player) => { const hours = assignments[player.id] ?? {}; const total = skills.reduce((sum, skill) => sum + (hours[skill] ?? 0), 0); skills.forEach((skill) => { const h = hours[skill] ?? 0; const maintenance = h >= 5; if (!maintenance && next(state) < 0.13) player.ratings[skill] = Math.max(1, player.ratings[skill] - 1); if (h > 5 && next(state) < Math.min(0.42, (h - 5) * 0.026)) player.ratings[skill] = Math.min(100, player.ratings[skill] + 1) }); if (total > 40) state.inbox.unshift(`${player.name}'s training was capped at 40 hours.`) })
  Object.entries(state.scoutingHours).forEach(([id, hours]) => { if (state.players[id]) state.players[id].scoutProgress = Math.min(100, state.players[id].scoutProgress + hours * 0.35) })
  Object.values(state.teams).forEach((team) => { const weeklySalary = team.playerIds.reduce((sum, id) => sum + (state.players[id]?.salary ?? 0) / 52, 0); team.cash -= weeklySalary })
  if (phase !== 'Offseason') { const opponent = opponentFor(state, current.id); const result = simulateSeries(state, current.id, opponent.id, state.week, attackStyle, defenseStyle); state.matches.unshift(result); current.cash += result.winnerId === current.id ? 25000 : 5000; state.inbox.unshift(`${result.winnerId === current.id ? 'Victory' : 'Defeat'} over ${opponent.name} in ${result.phase}.`); Object.values(state.teams).filter((team) => team.id !== current.id).slice(0, 7).forEach((team) => { const other = opponentFor(state, team.id); simulateSeries(state, team.id, other.id, state.week) }) }
  if (state.week % 8 === 0 && current.wins > current.losses) { const candidate = Object.values(state.teams).find((team) => team.id !== current.id && team.losses > team.wins && !state.jobs.some((job) => job.teamId === team.id && job.status === 'pending')); if (candidate) { state.jobs.unshift({ id: `job-${state.week}`, teamId: candidate.id, expiresWeek: state.week + 2, reason: 'The organization is seeking a new direction after a difficult run.', salary: 180000 + candidate.losses * 12000, status: 'pending' }); state.inbox.unshift(`${candidate.name} has opened a manager position for you.`) } }
  if (state.week === 6) current.championshipPoints += 2; if (state.week === 18) current.championshipPoints += 3; if (state.week === 34) current.championshipPoints += 4; state.week++; if (state.week > 52) { state.week = 1; state.season++; state.inbox.unshift(`The 2026 ruleset has been carried into season ${state.season}. Reset rosters or continue building your legacy.`) } state.saveTimestamp = new Date().toISOString(); saveGame(state); return state
}
export function acceptJob(state: GameState, jobId: string) { const nextState = structuredClone(state); const job = nextState.jobs.find((candidate) => candidate.id === jobId); if (!job) return nextState; nextState.currentTeamId = job.teamId; job.status = 'accepted'; nextState.inbox.unshift(`You accepted the manager role at ${nextState.teams[job.teamId].name}.`); saveGame(nextState); return nextState }
export { SAVE_KEY }
