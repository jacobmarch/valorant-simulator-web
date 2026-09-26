import { useMemo, useState } from 'react'
import { ArrowRight, Check, ChevronRight, CircleAlert, Info, TriangleAlert } from 'lucide-react'
import {
  activePhaseForWeek,
  acceptJob,
  competitionRecord,
  currentTeam,
  dateForWeek,
  hasMatchDetail,
  nextFixtureForTeam,
  phaseForWeek,
  rankedTeams,
  saveGame,
  type Fixture,
  type GameState,
  type MatchResult,
  type Player,
  type PlayerStat,
} from './game'
import { attentionItems, type AttentionItem } from './flow'
import { mapTiers, runVeto } from './maps'
import { maps, roles, type Role } from './seed'
import { playerOverall } from './transfers'
import {
  Badge,
  Empty,
  Modal,
  PanelTitle,
  Page,
  Stat,
  TeamMark,
  money,
  phaseName,
  regionColors,
  tone,
  type View,
} from './ui'

function recentManagedMatches(s: GameState, teamId = s.currentTeamId) {
  return s.matches.filter((match) => match.aId === teamId || match.bId === teamId).slice(0, 5)
}
function fixtureOpponent(fixture: Fixture | undefined, teamId: string) {
  if (!fixture) return undefined
  return fixture.aId === teamId ? fixture.bId : fixture.aId
}
function Form({ s, teamId }: { s: GameState; teamId: string }) {
  const recent = recentManagedMatches(s, teamId)
  return (
    <span className="form" title="Last five series, newest first">
      {recent.length ? (
        recent.map((match) => (
          <i className={match.winnerId === teamId ? 'w' : 'l'} key={match.id}>
            {match.winnerId === teamId ? 'W' : 'L'}
          </i>
        ))
      ) : (
        <em>No series yet</em>
      )}
    </span>
  )
}
function MiniStandings({ s, onView }: { s: GameState; onView: (view: View) => void }) {
  const team = currentTeam(s),
    active = activePhaseForWeek(s.week)
  const phase =
    active === 'Masters 1'
      ? 'Kickoff'
      : active === 'Masters 2'
        ? 'Stage 1'
        : active === 'Champions' || active === 'Offseason'
          ? 'Stage 2'
          : active
  const ids = Object.values(s.teams)
    .filter((candidate) => candidate.region === team.region)
    .map((candidate) => candidate.id)
  const ordered =
    phase === 'Kickoff'
      ? [...ids].sort(
          (a, b) =>
            s.kickoff[b].wins - s.kickoff[a].wins || s.kickoff[a].losses - s.kickoff[b].losses,
        )
      : rankedTeams(s, ids, phase)
  const own = ordered.indexOf(team.id)
  const shown = ordered.slice(0, 6).concat(own >= 6 ? [team.id] : [])
  return (
    <section className="panel mini-standings">
      <PanelTitle
        eyebrow={`${team.region} · ${phase}`}
        title="Regional table"
        right={
          <button className="link" onClick={() => onView('competition')}>
            Competition <ArrowRight size={14} />
          </button>
        }
      />
      {shown.map((id) => {
        const candidate = s.teams[id]
        const record = phase === 'Kickoff' ? s.kickoff[id] : competitionRecord(s, id, phase)
        return (
          <div className={`mini-row ${id === team.id ? 'current' : ''}`} key={id}>
            <b>{ordered.indexOf(id) + 1}</b>
            <span className="mini" style={{ background: candidate.color }}>
              {candidate.short.slice(0, 2)}
            </span>
            <strong>{candidate.name}</strong>
            <span>
              {record.wins}–{record.losses}
            </span>
            <small>
              {phase === 'Kickoff'
                ? `${Math.max(0, 3 - record.losses)} lives`
                : `${candidate.championshipPoints} CP`}
            </small>
          </div>
        )
      })}
    </section>
  )
}
const levelIcon = (item: AttentionItem) =>
  item.level === 'urgent' ? (
    <CircleAlert size={18} />
  ) : item.level === 'warn' ? (
    <TriangleAlert size={18} />
  ) : (
    <Info size={18} />
  )

export function DashboardV2({
  s,
  setState,
  setView,
  setMatchId,
  onPreview,
}: {
  s: GameState
  setState?: (state: GameState) => void
  setView: (view: View) => void
  setMatchId?: (id: string) => void
  onPreview?: (id: string) => void
}) {
  const team = currentTeam(s),
    fixture = nextFixtureForTeam(s, team.id, s.week),
    opponentId = fixtureOpponent(fixture, team.id)
  const opponent = opponentId ? s.teams[opponentId] : undefined,
    recentResults = recentManagedMatches(s)
  const job = s.jobs.find(
    (candidate) => candidate.status === 'pending' && candidate.expiresWeek >= s.week,
  )
  const todo = attentionItems(s)
  const starters = team.lineup.map((id) => s.players[id]).filter(Boolean)
  const squadRating = starters.length
    ? Math.round(starters.reduce((sum, player) => sum + playerOverall(player), 0) / starters.length)
    : 0
  const respond = (accept: boolean) => {
    if (!job || !setState) return
    if (accept) {
      setState(acceptJob(s, job.id))
      return
    }
    const next = structuredClone(s)
    const offer = next.jobs.find((candidate) => candidate.id === job.id)
    if (offer) offer.status = 'declined'
    saveGame(next)
    setState(next)
  }
  return (
    <Page
      eyebrow={`WEEK ${s.week} · ${dateForWeek(s.week)}`}
      title={team.name}
      subtitle={
        phaseForWeek(s.week) === 'Break'
          ? `Calendar break before ${activePhaseForWeek(s.week)}. A good week to sort the roster and training.`
          : `${phaseName(s.week)} is under way. Check the to-do list, then press Continue in the top bar.`
      }
    >
      <div className="home-grid">
        <section className="panel spotlight">
          <PanelTitle
            eyebrow={opponent ? 'NEXT SERIES' : 'SCHEDULE'}
            title={
              opponent && fixture
                ? `${fixture.phase} · ${fixture.label}`
                : phaseForWeek(s.week) === 'Break'
                  ? 'Calendar break'
                  : 'No series scheduled'
            }
            right={
              <Badge
                color={fixture?.scope === 'international' ? tone.accent : regionColors[team.region]}
              >
                {fixture?.scope === 'international' ? 'International' : team.region}
              </Badge>
            }
          />
          {opponent && fixture ? (
            <>
              <div className="versus">
                <div>
                  <TeamMark s={s} id={team.id} size="lg" />
                  <strong>{team.name}</strong>
                  <Form s={s} teamId={team.id} />
                </div>
                <em>vs</em>
                <div>
                  <TeamMark s={s} id={opponent.id} size="lg" />
                  <strong>{opponent.name}</strong>
                  <Form s={s} teamId={opponent.id} />
                </div>
              </div>
              <div className="fixture-meta">
                <span>
                  <small>Date</small>
                  {dateForWeek(fixture.week)}
                </span>
                <span>
                  <small>Format</small>
                  Best of {fixture.bestOf}
                </span>
                <span>
                  <small>Week</small>
                  {fixture.week === s.week ? 'This week' : `Week ${fixture.week}`}
                </span>
              </div>
            </>
          ) : (
            <p className="muted spotlight-empty">
              {s.week === 1 && s.kickoff[team.id]?.openingBye
                ? 'You have an opening-round bye. Your first series is set once round one is played.'
                : 'Your next opponent is decided by results elsewhere. Continue to move the calendar on.'}
            </p>
          )}
          <div className="spotlight-actions">
            {opponent && (
              <button className="primary" onClick={() => setView('tactics')}>
                Match prep <ArrowRight size={15} />
              </button>
            )}
            <button className="secondary" onClick={() => setView('competition')}>
              {fixture?.phase === 'Kickoff' ? 'Kickoff bracket' : 'Fixtures & standings'}
            </button>
          </div>
        </section>
        <section className="panel todo">
          <PanelTitle
            eyebrow="TO-DO"
            title="Before you continue"
            right={
              <Badge color={todo.some((item) => item.level !== 'info') ? tone.warn : tone.accent}>
                {todo.filter((item) => item.level !== 'info').length || 'All clear'}
              </Badge>
            }
          />
          {job && (
            <div className="todo-offer">
              <div>
                <small>Job offer · expires week {job.expiresWeek}</small>
                <strong>{s.teams[job.teamId].name}</strong>
                <span>
                  {money(job.salary)} a year. {job.reason}
                </span>
              </div>
              <div>
                <button className="primary compact" onClick={() => respond(true)}>
                  Accept
                </button>
                <button className="secondary compact" onClick={() => respond(false)}>
                  Decline
                </button>
              </div>
            </div>
          )}
          {todo.length ? (
            todo.map((item) => (
              <button
                className={`todo-item ${item.level}`}
                onClick={() => setView(item.view)}
                key={item.id}
              >
                {levelIcon(item)}
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))
          ) : (
            <div className="todo-clear">
              <Check size={18} />
              Nothing needs you right now.
            </div>
          )}
        </section>
        <MiniStandings s={s} onView={setView} />
        <section className="panel recent-results-panel">
          <PanelTitle
            eyebrow="RESULTS"
            title="Recent series"
            right={
              <button className="link" onClick={() => setView('matches')}>
                Match center <ArrowRight size={14} />
              </button>
            }
          />
          <div className="recent-results">
            {recentResults.length ? (
              recentResults.map((match) => {
                const home = s.teams[match.aId],
                  away = s.teams[match.bId],
                  won = match.winnerId === team.id
                return (
                  <button
                    className="recent-result"
                    key={match.id}
                    onClick={() => {
                      if (onPreview) onPreview(match.id)
                      else {
                        setMatchId?.(match.id)
                        setView('matches')
                      }
                    }}
                  >
                    <span className={`result-tag ${won ? 'w' : 'l'}`}>{won ? 'W' : 'L'}</span>
                    <span className="recent-result-score">
                      <strong className={match.winnerId === match.aId ? 'winner' : ''}>
                        {home.short}
                      </strong>
                      <b>
                        {match.aScore}–{match.bScore}
                      </b>
                      <strong className={match.winnerId === match.bId ? 'winner' : ''}>
                        {away.short}
                      </strong>
                    </span>
                    <span className="recent-result-date">
                      {match.phase} · W{match.week} <ChevronRight size={15} />
                    </span>
                  </button>
                )
              })
            ) : (
              <div className="recent-results-empty">No series played yet.</div>
            )}
          </div>
        </section>
        <section className="panel inbox-panel">
          <PanelTitle eyebrow="INBOX" title="Around the league" />
          <div className="inbox-list">
            {s.inbox.slice(0, 8).map((message, index) => (
              <div className="inbox" key={`${message}-${index}`}>
                <i />
                {message}
              </div>
            ))}
          </div>
        </section>
        <section className="panel snapshot">
          <PanelTitle eyebrow="CLUB" title="Snapshot" />
          <div className="stats">
            <Stat
              label="Season record"
              value={`${team.wins}–${team.losses}`}
              detail={`${team.mapWins}–${team.mapLosses} maps`}
            />
            <Stat
              label="Champ. points"
              value={String(team.championshipPoints)}
              detail={team.playoffStage || 'Champions qualification race'}
            />
            <Stat
              label="Cash balance"
              value={money(team.cash)}
              detail={`${money(team.salaryBudget)} salary budget`}
            />
            <Stat
              label="Starting five"
              value={squadRating ? `${squadRating} OVR` : '—'}
              detail={`${starters.length}/5 starters set`}
            />
          </div>
        </section>
      </div>
    </Page>
  )
}

export function TacticsV2({
  s,
  setState,
  attack,
  setAttack,
  defense,
  setDefense,
}: {
  s: GameState
  setState: (state: GameState) => void
  attack: string
  setAttack: (value: string) => void
  defense: string
  setDefense: (value: string) => void
}) {
  const team = currentTeam(s),
    players = team.lineup.map((id) => s.players[id]).filter(Boolean)
  const fixture = nextFixtureForTeam(s, team.id, s.week),
    opponentId = fixtureOpponent(fixture, team.id),
    opponent = opponentId ? s.teams[opponentId] : undefined
  const ownTiers = mapTiers(s, team.id),
    opponentTiers = opponent ? mapTiers(s, opponent.id) : ownTiers
  const setRole = (player: Player, role: Role) => {
    const next = structuredClone(s)
    next.teams[team.id].roleAssignments[player.id] = role
    saveGame(next)
    setState(next)
  }
  return (
    <Page
      eyebrow={`MATCH PREP / ${phaseName(s.week)}`}
      title={opponent ? `${team.name} vs ${opponent.name}` : 'No match to prepare'}
      subtitle={
        opponent
          ? `${fixture?.label} · ${dateForWeek(fixture?.week ?? s.week)} · BO${fixture?.bestOf}`
          : 'Open Competition to review the current bracket and upcoming schedule.'
      }
    >
      <div className="columns">
        <section className="panel">
          <PanelTitle
            eyebrow="STARTING LINEUP"
            title="Five for the series"
            right={<span className="muted">Role fit matters</span>}
          />
          {players.map((player, index) => (
            <div className="lineup" key={player.id}>
              <b>0{index + 1}</b>
              <span>
                <strong>{player.name}</strong>
                <small>
                  Primary {player.primaryRole} ·{' '}
                  {player.secondaryRoles.join(', ') || 'no secondary'}
                </small>
              </span>
              <select
                value={team.roleAssignments[player.id] ?? player.primaryRole}
                onChange={(event) => setRole(player, event.target.value as Role)}
              >
                {roles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </div>
          ))}
        </section>
        <section className="panel">
          <PanelTitle eyebrow="SERIES PLAN" title="Broad tactical identity" />
          <label className="field">
            Attack style
            <select value={attack} onChange={(event) => setAttack(event.target.value)}>
              <option>Measured defaults</option>
              <option>Fast and explosive</option>
              <option>Slow information play</option>
            </select>
          </label>
          <label className="field">
            Defense style
            <select value={defense} onChange={(event) => setDefense(event.target.value)}>
              <option>Disciplined retakes</option>
              <option>Proactive contesting</option>
              <option>Deep site anchors</option>
            </select>
          </label>
          <div className="maps">
            <div className="eyebrow">
              {opponent ? 'PROJECTED VETO / MAP TIERS (1 = BEST)' : 'MAP TIERS (1 = BEST)'}
            </div>
            {opponent && fixture
              ? runVeto(s, fixture.aId, fixture.bId ?? opponent.id, fixture.bestOf).steps.map(
                  (step, index) => (
                    <div className={step.action === 'ban' ? 'map' : 'map selected'} key={step.map}>
                      <b>{index + 1}</b>
                      {step.map}
                      <small>
                        {step.action === 'decider'
                          ? 'decider'
                          : `${s.teams[step.teamId].short} ${step.action}`}{' '}
                        · {team.short} T{ownTiers[step.map]} / {opponent.short} T
                        {opponentTiers[step.map]}
                      </small>
                    </div>
                  ),
                )
              : maps
                  .slice()
                  .sort((a, b) => ownTiers[a] - ownTiers[b])
                  .map((map) => (
                    <div className="map" key={map}>
                      <b>{ownTiers[map]}</b>
                      {map}
                      <small>tier {ownTiers[map]}</small>
                    </div>
                  ))}
          </div>
        </section>
      </div>
    </Page>
  )
}

function aggregateStats(
  match: MatchResult,
  mapIndex: 'series' | number,
): Record<string, PlayerStat> {
  const selected = mapIndex === 'series' ? match.maps : [match.maps[mapIndex]]
  const totals: Record<string, PlayerStat & { maps: number }> = {}
  selected.forEach((map) =>
    Object.entries(map.stats).forEach(([id, stat]) => {
      const current = totals[id] ?? {
        kills: 0,
        deaths: 0,
        assists: 0,
        acs: 0,
        adr: 0,
        kast: 0,
        firstKills: 0,
        firstDeaths: 0,
        clutches: 0,
        plants: 0,
        defuses: 0,
        headshots: 0,
        maps: 0,
      }
      current.kills += stat.kills
      current.deaths += stat.deaths
      current.assists += stat.assists
      current.acs += stat.acs
      current.adr += stat.adr
      current.kast += stat.kast
      current.firstKills += stat.firstKills
      current.firstDeaths += stat.firstDeaths
      current.clutches += stat.clutches
      current.plants += stat.plants
      current.defuses += stat.defuses
      current.headshots += stat.headshots
      current.maps++
      totals[id] = current
    }),
  )
  return Object.fromEntries(
    Object.entries(totals).map(([id, stat]) => [
      id,
      {
        ...stat,
        acs: Math.round(stat.acs / stat.maps),
        adr: Math.round(stat.adr / stat.maps),
        kast: Math.round(stat.kast / stat.maps),
      },
    ]),
  )
}

type ScoreboardMode = 'teams' | 'lobby'
type ScoreDirection = 'asc' | 'desc'
type ScoreNumericKey =
  | 'acs'
  | 'adr'
  | 'kills'
  | 'deaths'
  | 'assists'
  | 'kast'
  | 'firstKills'
  | 'firstDeaths'
  | 'clutches'
  | 'plants'
  | 'defuses'
  | 'headshots'
type ScoreSortKey = 'player' | 'kd' | ScoreNumericKey

const scoreColumns: Array<{ key: ScoreSortKey; label: string }> = [
  { key: 'player', label: 'Player' },
  { key: 'acs', label: 'ACS' },
  { key: 'adr', label: 'ADR / damage' },
  { key: 'kd', label: 'K/D' },
  { key: 'assists', label: 'Assists' },
  { key: 'kast', label: 'KAST' },
  { key: 'firstKills', label: 'FK' },
  { key: 'firstDeaths', label: 'FD' },
  { key: 'clutches', label: 'Clutches' },
  { key: 'plants', label: 'Plants' },
  { key: 'defuses', label: 'Defuses' },
  { key: 'headshots', label: 'HS' },
]

function scoreValue(
  s: GameState,
  id: string,
  stat: PlayerStat,
  key: ScoreSortKey,
): number | string {
  if (key === 'player') return s.players[id]?.name ?? ''
  if (key === 'kd') return stat.deaths ? stat.kills / stat.deaths : stat.kills
  return {
    acs: stat.acs,
    adr: stat.adr,
    kills: stat.kills,
    deaths: stat.deaths,
    assists: stat.assists,
    kast: stat.kast,
    firstKills: stat.firstKills,
    firstDeaths: stat.firstDeaths,
    clutches: stat.clutches,
    plants: stat.plants,
    defuses: stat.defuses,
    headshots: stat.headshots,
  }[key]
}

function scoreCell(stat: PlayerStat, key: ScoreSortKey, player?: Player) {
  if (key === 'player')
    return (
      <>
        <strong>{player?.name}</strong>
        <small>{player?.primaryRole}</small>
      </>
    )
  if (key === 'kd') return `${stat.kills}/${stat.deaths}`
  if (key === 'kast') return `${stat.kast}%`
  return {
    acs: stat.acs,
    adr: stat.adr,
    kills: stat.kills,
    deaths: stat.deaths,
    assists: stat.assists,
    firstKills: stat.firstKills,
    firstDeaths: stat.firstDeaths,
    clutches: stat.clutches,
    plants: stat.plants,
    defuses: stat.defuses,
    headshots: stat.headshots,
  }[key]
}

function sortedScoreIds(
  s: GameState,
  stats: Record<string, PlayerStat>,
  ids: string[],
  key: ScoreSortKey,
  direction: ScoreDirection,
) {
  return [...ids].sort((leftId, rightId) => {
    const left = scoreValue(s, leftId, stats[leftId], key),
      right = scoreValue(s, rightId, stats[rightId], key)
    const comparison =
      typeof left === 'string' && typeof right === 'string'
        ? left.localeCompare(right)
        : Number(left) - Number(right)
    return comparison === 0
      ? (s.players[leftId]?.name ?? '').localeCompare(s.players[rightId]?.name ?? '') *
          (direction === 'asc' ? 1 : -1)
      : comparison * (direction === 'asc' ? 1 : -1)
  })
}

function ScoreHeader({
  column,
  sortKey,
  direction,
  onSort,
}: {
  column: { key: ScoreSortKey; label: string }
  sortKey: ScoreSortKey
  direction: ScoreDirection
  onSort: (key: ScoreSortKey) => void
}) {
  const active = sortKey === column.key
  const numeric = column.key !== 'player'
  return (
    <th
      className={numeric ? 'scoreboard-num' : undefined}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className={active ? 'scoreboard-sort active' : 'scoreboard-sort'}
        onClick={() => onSort(column.key)}
      >
        {column.label}
        <span aria-hidden="true">{active ? (direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
      </button>
    </th>
  )
}

function ScoreTable({
  s,
  stats,
  ids,
  sortKey,
  direction,
  onSort,
  showRank = false,
  showTeam = false,
}: {
  s: GameState
  stats: Record<string, PlayerStat>
  ids: string[]
  sortKey: ScoreSortKey
  direction: ScoreDirection
  onSort: (key: ScoreSortKey) => void
  showRank?: boolean
  showTeam?: boolean
}) {
  const ordered = sortedScoreIds(s, stats, ids, sortKey, direction)
  return (
    <div className="table-wrap scoreboard-table-wrap">
      <table className="scoreboard-table">
        <thead>
          <tr>
            {showRank && <th className="scoreboard-rank-head">#</th>}
            {showTeam && <th>Team</th>}
            {scoreColumns.map((column) => (
              <ScoreHeader
                key={column.key}
                column={column}
                sortKey={sortKey}
                direction={direction}
                onSort={onSort}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map((id, index) => {
            const player = s.players[id],
              team = s.teams[player?.teamId ?? '']
            if (!player || !stats[id]) return null
            return (
              <tr key={id}>
                {showRank && (
                  <td className="scoreboard-rank">{String(index + 1).padStart(2, '0')}</td>
                )}
                {showTeam && (
                  <td>
                    <span className="scoreboard-team-tag">
                      <i style={{ background: team?.color }} />
                      {team?.short}
                    </span>
                  </td>
                )}
                {scoreColumns.map((column) => (
                  <td
                    key={column.key}
                    className={column.key === 'player' ? 'scoreboard-player' : 'scoreboard-num'}
                  >
                    {scoreCell(stats[id], column.key, player)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Stats are recorded team A's lineup first, so the side a player played on
// survives later transfers.
function matchSide(s: GameState, match: MatchResult, playerId: string) {
  const ids = Object.keys(match.maps[0]?.stats ?? {}),
    index = ids.indexOf(playerId)
  if (index < 0) return s.players[playerId]?.teamId
  return index < ids.length / 2 ? match.aId : match.bId
}

function Scoreboard({
  s,
  match,
  stats,
  mode,
  sortKey,
  direction,
  onSort,
  onModeChange,
}: {
  s: GameState
  match: MatchResult
  stats: Record<string, PlayerStat>
  mode: ScoreboardMode
  sortKey: ScoreSortKey
  direction: ScoreDirection
  onSort: (key: ScoreSortKey) => void
  onModeChange: (mode: ScoreboardMode) => void
}) {
  const teams = [match.aId, match.bId]
  const allIds = Object.keys(stats)
  return (
    <div className="scoreboard">
      <div className="scoreboard-toolbar">
        <div>
          <div className="eyebrow">SCOREBOARD VIEW</div>
          <div className="scoreboard-mode">
            <button
              type="button"
              className={mode === 'teams' ? 'active' : ''}
              onClick={() => onModeChange('teams')}
            >
              Teams separated
            </button>
            <button
              type="button"
              className={mode === 'lobby' ? 'active' : ''}
              onClick={() => onModeChange('lobby')}
            >
              Lobby ranking
            </button>
          </div>
        </div>
        <span className="muted">Click any column to sort · default: ACS</span>
      </div>
      {mode === 'teams' ? (
        <div className="scoreboard-teams">
          {teams.map((teamId, index) => {
            const team = s.teams[teamId],
              teamIds = allIds.filter((id) => matchSide(s, match, id) === teamId)
            return (
              <section
                className={
                  index === 0
                    ? 'scoreboard-team scoreboard-team-a'
                    : 'scoreboard-team scoreboard-team-b'
                }
                key={teamId}
              >
                <div className="scoreboard-team-head">
                  <div>
                    <span className="scoreboard-team-kicker">
                      {index === 0 ? 'TEAM A' : 'TEAM B'}
                    </span>
                    <strong>
                      <i style={{ background: team.color }} />
                      {team.name}
                    </strong>
                  </div>
                  <span className="scoreboard-team-score">
                    {team.short}
                    <b>{teamId === match.aId ? match.aScore : match.bScore}</b>
                  </span>
                </div>
                <ScoreTable
                  s={s}
                  stats={stats}
                  ids={teamIds}
                  sortKey={sortKey}
                  direction={direction}
                  onSort={onSort}
                />
              </section>
            )
          })}
        </div>
      ) : (
        <section className="scoreboard-lobby">
          <div className="scoreboard-lobby-head">
            <div>
              <span className="scoreboard-team-kicker">ALL PLAYERS</span>
              <strong>Lobby ranking</strong>
            </div>
            <span className="muted">Ranked across both teams</span>
          </div>
          <ScoreTable
            s={s}
            stats={stats}
            ids={allIds}
            sortKey={sortKey}
            direction={direction}
            onSort={onSort}
            showRank
            showTeam
          />
        </section>
      )}
    </div>
  )
}

export function MatchesV2({ s, initialMatchId }: { s: GameState; initialMatchId?: string }) {
  const matches = s.matches
  const managedMatches = s.matches.filter(
    (match) => match.aId === s.currentTeamId || match.bId === s.currentTeamId,
  )
  const [selectedId, setSelectedId] = useState(
    matches.find((match) => match.id === initialMatchId)?.id ??
      managedMatches[0]?.id ??
      matches[0]?.id ??
      '',
  )
  const [tab, setTab] = useState<'series' | number>('series')
  const [scoreboardMode, setScoreboardMode] = useState<ScoreboardMode>('teams')
  const [sortKey, setSortKey] = useState<ScoreSortKey>('acs')
  const [sortDirection, setSortDirection] = useState<ScoreDirection>('desc')
  const [showNotes, setShowNotes] = useState(false)
  const match = matches.find((candidate) => candidate.id === selectedId) ?? matches[0]
  const stats = useMemo(() => (match ? aggregateStats(match, tab) : {}), [match, tab])
  const setScoreSort = (key: ScoreSortKey) => {
    if (key === sortKey) setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))
    else {
      setSortKey(key)
      setSortDirection(key === 'player' ? 'asc' : 'desc')
    }
  }
  if (!match)
    return (
      <Page
        eyebrow="MATCHDAY / RESULTS"
        title="Match center"
        subtitle="Advance the week to play your first series."
      >
        <Empty title="No matches played yet" body="Your first result will appear here." />
      </Page>
    )
  const selectedMaps = tab === 'series' ? match.maps : [match.maps[tab]]
  const keyRounds =
    tab === 'series'
      ? []
      : selectedMaps[0].rounds
          .filter(
            (round) => round.includes('ACE') || round.includes('3K') || round.startsWith('OT'),
          )
          .slice(-8)
  return (
    <Page
      eyebrow="MATCHDAY / RESULTS"
      title="Match center"
      actions={
        <>
          <select
            className="series-select"
            aria-label="Series"
            value={match.id}
            onChange={(event) => {
              setSelectedId(event.target.value)
              setTab('series')
            }}
          >
            {matches.map((candidate) => (
              <option value={candidate.id} key={candidate.id}>
                W{candidate.week} · {s.teams[candidate.aId].short} {candidate.aScore}-
                {candidate.bScore} {s.teams[candidate.bId].short}
              </option>
            ))}
          </select>
          <button className="secondary" onClick={() => setShowNotes(true)}>
            {tab === 'series' ? 'Highlights' : 'Key rounds'}
          </button>
        </>
      }
    >
      <section className="broadcast">
        <div>
          <span>{match.phase}</span>
          <span>
            WEEK {match.week} · BO{match.bestOf}
          </span>
        </div>
        <strong>
          {s.teams[match.aId].short}
          <b className={match.winnerId === match.aId ? 'win' : ''}>{match.aScore}</b> :{' '}
          <b className={match.winnerId === match.bId ? 'win' : ''}>{match.bScore}</b>
          {s.teams[match.bId].short}
        </strong>
        <div className="map-results">
          {match.maps.map((map, index) => (
            <button
              className={tab === index ? 'active' : ''}
              onClick={() => setTab(index)}
              key={map.map + '-' + index}
            >
              <small>{map.map}</small>
              <b>
                {map.aScore} — {map.bScore}
              </b>
              <em>{s.teams[map.winnerId].short} won</em>
            </button>
          ))}
        </div>
      </section>
      <section className="panel match-box">
        <div className="view-tabs">
          <button className={tab === 'series' ? 'active' : ''} onClick={() => setTab('series')}>
            Entire series
          </button>
          {match.maps.map((map, index) => (
            <button
              className={tab === index ? 'active' : ''}
              onClick={() => setTab(index)}
              key={map.map + '-tab'}
            >
              {map.map}
            </button>
          ))}
        </div>
        {hasMatchDetail(match) ? (
          <Scoreboard
            s={s}
            match={match}
            stats={stats}
            mode={scoreboardMode}
            sortKey={sortKey}
            direction={sortDirection}
            onSort={setScoreSort}
            onModeChange={setScoreboardMode}
          />
        ) : (
          <p className="muted">
            Box scores and round logs are only kept for recent matches and your own team's matches
            this season.
          </p>
        )}
      </section>
      {showNotes && (
        <Modal
          eyebrow={tab === 'series' ? 'SERIES NOTES' : 'ROUND REPLAY'}
          title={
            tab === 'series' ? 'Match highlights' : match.maps[tab as number].map + ' key rounds'
          }
          onClose={() => setShowNotes(false)}
        >
          {(tab === 'series'
            ? [
                ...match.highlights,
                ...(match.vetoLog?.length ? [`Veto: ${match.vetoLog.join(', ')}.`] : []),
              ]
            : keyRounds.length
              ? keyRounds
              : selectedMaps[0].rounds.slice(-6)
          ).map((text, index) => (
            <div className="highlight" key={text + '-' + index}>
              ✦ {text}
            </div>
          ))}
        </Modal>
      )}
    </Page>
  )
}

/** Quick look at a series without leaving the current page. */
export function MatchPreview({
  s,
  matchId,
  onClose,
  onOpenFull,
}: {
  s: GameState
  matchId: string
  onClose: () => void
  onOpenFull: (id: string) => void
}) {
  const match = s.matches.find((candidate) => candidate.id === matchId)
  if (!match) return null
  const a = s.teams[match.aId],
    b = s.teams[match.bId]
  const stats = hasMatchDetail(match) ? aggregateStats(match, 'series') : {}
  const top = Object.entries(stats)
    .sort(([, left], [, right]) => right.acs - left.acs)
    .slice(0, 3)
  return (
    <Modal
      eyebrow={`${match.phase} · Week ${match.week} · Bo${match.bestOf}`}
      title={`${a.name} vs ${b.name}`}
      onClose={onClose}
    >
      <div className="preview-score">
        <span className={match.winnerId === a.id ? 'winner' : ''}>
          <TeamMark s={s} id={a.id} />
          {a.short}
        </span>
        <b>
          {match.aScore} – {match.bScore}
        </b>
        <span className={match.winnerId === b.id ? 'winner' : ''}>
          {b.short}
          <TeamMark s={s} id={b.id} />
        </span>
      </div>
      <div className="preview-maps">
        {match.maps.map((map, index) => (
          <div key={`${map.map}-${index}`}>
            <small>{map.map}</small>
            <strong>
              {map.aScore}–{map.bScore}
            </strong>
            <em>{s.teams[map.winnerId]?.short}</em>
          </div>
        ))}
      </div>
      {top.length > 0 && (
        <>
          <h3 className="modal-subhead">Top performers</h3>
          {top.map(([id, stat]) => (
            <div className="preview-player" key={id}>
              <strong>{s.players[id]?.name}</strong>
              <span className="muted">{s.teams[matchSide(s, match, id) ?? '']?.short}</span>
              <span>{stat.acs} ACS</span>
              <span className="muted">
                {stat.kills}/{stat.deaths}
              </span>
            </div>
          ))}
        </>
      )}
      {match.highlights.length > 0 && (
        <>
          <h3 className="modal-subhead">Highlights</h3>
          <ul className="preview-notes">
            {match.highlights.slice(0, 3).map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </>
      )}
      <div className="modal-actions">
        <button className="primary" onClick={() => onOpenFull(match.id)}>
          Full box score <ArrowRight size={15} />
        </button>
      </div>
    </Modal>
  )
}
