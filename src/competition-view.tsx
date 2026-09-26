import { createContext, useContext, useState, type ReactNode } from 'react'
import {
  activePhaseForWeek,
  competitionRecord,
  currentTeam,
  dateForWeek,
  fixturesForWeek,
  currentTournamentDeskFixtures,
  liveTournamentRoundFixtures,
  phaseForWeek,
  playableTournamentFixtureIds,
  rankedTeams,
  regionalPlayoffQualifiers,
  type CompetitionPhase,
  type Fixture,
  type GameState,
} from './game'
import { type Region } from './seed'
import { Info } from 'lucide-react'
import { Badge, Modal, PanelTitle, regionColors as colors, tone } from './ui'

type PlayablePhase = Exclude<CompetitionPhase, 'Break' | 'Offseason'>
type EventInfo = {
  start: number
  end: number
  type: 'regional' | 'international'
  location: string
  format: string
  stakes: string
  playoffStart?: number
}
const regions: Region[] = ['Americas', 'EMEA', 'Pacific', 'China']
const SimMatchContext = createContext<{
  playable: Set<string>
  onSimMatch?: (fixtureId: string) => void
}>({ playable: new Set() })
const events: Record<PlayablePhase, EventInfo> = {
  Kickoff: {
    start: 1,
    end: 6,
    type: 'regional',
    location: 'Regional studios',
    format: 'Triple elimination',
    stakes: 'Three Masters 1 places per region',
  },
  'Masters 1': {
    start: 8,
    end: 10,
    playoffStart: 10,
    type: 'international',
    location: 'São Paulo',
    format: 'Swiss into double elimination',
    stakes: 'International title and Championship Points',
  },
  'Stage 1': {
    start: 12,
    end: 18,
    playoffStart: 16,
    type: 'regional',
    location: 'Regional leagues',
    format: 'League stage and playoffs',
    stakes: 'Three Masters 2 places per region',
  },
  'Masters 2': {
    start: 20,
    end: 22,
    playoffStart: 22,
    type: 'international',
    location: 'Berlin',
    format: 'Swiss into double elimination',
    stakes: 'International title and Championship Points',
  },
  'Stage 2': {
    start: 24,
    end: 34,
    playoffStart: 32,
    type: 'regional',
    location: 'Regional roadshows',
    format: 'League stage and playoffs',
    stakes: 'Champions qualification',
  },
  Champions: {
    start: 36,
    end: 42,
    playoffStart: 39,
    type: 'international',
    location: 'Seoul',
    format: 'Groups into double elimination',
    stakes: 'The 2026 world championship',
  },
}
const eventOrder = Object.keys(events) as PlayablePhase[]
const statusFor = (s: GameState, phase: PlayablePhase) =>
  s.week > events[phase].end
    ? 'Complete'
    : s.week < events[phase].start
      ? 'Upcoming'
      : 'In progress'
const playoffStartFor = (phase: PlayablePhase) => events[phase].playoffStart ?? events[phase].end
const stageFor = (fixture: Fixture) =>
  fixture.stage ??
  (fixture.phase.startsWith('Masters')
    ? fixture.week === events[fixture.phase as 'Masters 1' | 'Masters 2'].end
      ? 'Playoffs'
      : 'Swiss'
    : fixture.phase === 'Champions'
      ? fixture.week >= 39
        ? 'Playoffs'
        : 'Groups'
      : 'League')

function FixtureCard({
  s,
  fixture,
  featured = false,
  compact = false,
  onOpenMatch,
}: {
  s: GameState
  fixture: Fixture
  featured?: boolean
  compact?: boolean
  onOpenMatch?: (matchId: string) => void
}) {
  const result = fixture.resultId
    ? s.matches.find((match) => match.id === fixture.resultId)
    : undefined
  const a = s.teams[fixture.aId],
    b = fixture.bId ? s.teams[fixture.bId] : undefined,
    managed = fixture.aId === s.currentTeamId || fixture.bId === s.currentTeamId
  const score = (id: string) => (result ? (result.aId === id ? result.aScore : result.bScore) : '—')
  const { playable, onSimMatch } = useContext(SimMatchContext)
  const canSim = !!onSimMatch && fixture.status === 'scheduled' && playable.has(fixture.id)
  return (
    <article
      onClick={result && onOpenMatch ? () => onOpenMatch(result.id) : undefined}
      role={result && onOpenMatch ? 'button' : undefined}
      onKeyDown={
        result && onOpenMatch
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpenMatch(result.id)
              }
            }
          : undefined
      }
      tabIndex={result && onOpenMatch ? 0 : undefined}
      className={`matchup-card ${fixture.status} ${managed ? 'managed' : ''} ${featured ? 'featured' : ''} ${compact ? 'compact' : ''}`}
      title={`${fixture.label} · Week ${fixture.week} · Bo${fixture.bestOf}`}
    >
      <header>
        <span>{fixture.label}</span>
        <span>
          {fixture.status === 'completed' ? 'Final' : `Week ${fixture.week} · BO${fixture.bestOf}`}
        </span>
      </header>
      <div className="matchup-teams">
        <div className={result?.winnerId === a.id ? 'winner' : ''}>
          <i style={{ background: a.color }} />
          <strong>{featured ? a.name : a.short}</strong>
          <small>{a.region}</small>
          <b>{score(a.id)}</b>
        </div>
        <div className={b && result?.winnerId === b.id ? 'winner' : ''}>
          {b ? (
            <>
              <i style={{ background: b.color }} />
              <strong>{featured ? b.name : b.short}</strong>
              <small>{b.region}</small>
              <b>{score(b.id)}</b>
            </>
          ) : (
            <>
              <i className="bye" />
              <strong>Bye</strong>
              <small>No opponent</small>
              <b>—</b>
            </>
          )}
        </div>
      </div>
      {canSim && (
        <button
          className="sim-match"
          onClick={(event) => {
            event.stopPropagation()
            onSimMatch(fixture.id)
          }}
        >
          {compact ? 'Sim' : 'Sim match'}
        </button>
      )}
    </article>
  )
}
function TeamTable({ s, region, phase }: { s: GameState; region: Region; phase: PlayablePhase }) {
  const ids = Object.values(s.teams)
    .filter((team) => team.region === region)
    .map((team) => team.id)
  const ordered =
    phase === 'Kickoff'
      ? [...ids].sort(
          (a, b) =>
            s.kickoff[b].wins - s.kickoff[a].wins || s.kickoff[a].losses - s.kickoff[b].losses,
        )
      : rankedTeams(s, ids, phase)
  return (
    <div className="table-wrap competition-table">
      <table>
        <thead>
          <tr>
            <th>Pos</th>
            <th>Organization</th>
            <th>Series</th>
            <th>Maps</th>
            <th>{phase === 'Kickoff' ? 'Bracket' : 'Qualification'}</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((id, index) => {
            const team = s.teams[id],
              record = phase === 'Kickoff' ? s.kickoff[id] : competitionRecord(s, id, phase)
            const playoffComplete =
              phase === 'Stage 1' || phase === 'Stage 2'
                ? s.fixtures.some(
                    (fixture) =>
                      fixture.season === s.season &&
                      fixture.phase === phase &&
                      fixture.region === region &&
                      fixture.label === 'Grand Final' &&
                      fixture.status === 'completed',
                  )
                : false
            const qualifiers =
              phase === 'Stage 1' || phase === 'Stage 2'
                ? regionalPlayoffQualifiers(s, phase, region)
                : []
            const qualification = playoffComplete ? qualifiers.indexOf(id) : -1
            const label =
              phase === 'Kickoff'
                ? s.kickoff[id].status === 'active'
                  ? record.losses === 0
                    ? 'Upper'
                    : record.losses === 1
                      ? 'Middle'
                      : 'Lower'
                  : s.kickoff[id].status
                : qualification >= 0
                  ? (phase === 'Stage 1' ? 'Masters 2 #' : 'Champions #') + (qualification + 1)
                  : index < 8
                    ? 'Playoff line'
                    : 'Outside top 8'
            return (
              <tr className={id === s.currentTeamId ? 'current' : ''} key={id}>
                <td>{String(index + 1).padStart(2, '0')}</td>
                <td>
                  <strong>
                    <span className="mini" style={{ background: team.color }}>
                      {team.short.slice(0, 2)}
                    </span>
                    {team.name}
                  </strong>
                </td>
                <td>
                  {record.wins}–{record.losses}
                </td>
                <td>{'mapWins' in record ? `${record.mapWins}–${record.mapLosses}` : '—'}</td>
                <td>
                  <Badge
                    color={
                      label === 'qualified' || label === 'Playoff line' || label.includes('#')
                        ? tone.accent
                        : label === 'eliminated'
                          ? tone.neg
                          : tone.muted
                    }
                  >
                    {label}
                  </Badge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
function RegionPicker({
  region,
  setRegion,
}: {
  region: Region
  setRegion: (value: Region) => void
}) {
  return (
    <div className="region-picker">
      {regions.map((value) => (
        <button
          className={region === value ? 'active' : ''}
          onClick={() => setRegion(value)}
          key={value}
        >
          <i style={{ background: colors[value] }} />
          {value}
        </button>
      ))}
    </div>
  )
}
function Schedule({
  s,
  fixtures,
  title,
  empty,
  onOpenMatch,
  controls,
}: {
  s: GameState
  fixtures: Fixture[]
  title: string
  empty?: string
  onOpenMatch?: (matchId: string) => void
  controls?: ReactNode
}) {
  return (
    <section className="panel schedule-panel">
      <PanelTitle
        eyebrow="MATCH DESK"
        title={title}
        right={controls ?? <Badge>{fixtures.length} matches</Badge>}
      />
      {fixtures.length ? (
        <div className="matchup-grid">
          {fixtures.map((fixture) => (
            <FixtureCard
              s={s}
              fixture={fixture}
              featured
              onOpenMatch={onOpenMatch}
              key={fixture.id}
            />
          ))}
        </div>
      ) : (
        <div className="competition-empty">
          <strong>Nothing on the slate</strong>
          <span>{empty ?? 'No matches are scheduled in this window.'}</span>
        </div>
      )}
    </section>
  )
}
function Matchday({
  week,
  setWeek,
  min,
  max,
}: {
  week: number
  setWeek: (week: number) => void
  min: number
  max: number
}) {
  return (
    <div className="matchday-control">
      <button onClick={() => setWeek(Math.max(min, week - 1))} aria-label="Previous week">
        ←
      </button>
      <strong>
        Week {week} · {dateForWeek(week)}
      </strong>
      <button onClick={() => setWeek(Math.min(max, week + 1))} aria-label="Next week">
        →
      </button>
    </div>
  )
}

function KickoffBracket({
  s,
  fixtures,
  onOpenMatch,
}: {
  s: GameState
  fixtures: Fixture[]
  onOpenMatch?: (matchId: string) => void
}) {
  const paths = [
    {
      key: 'upper',
      title: 'Upper bracket',
      note: 'The four opening winners meet the four bye teams. The path winner qualifies.',
      rounds: [
        {
          label: 'Upper Round 1',
          expected: 4,
          flow: 'straight',
          source: '8 teams play · 4 teams hold byes',
        },
        {
          label: 'Upper Round 2',
          expected: 4,
          flow: 'merge',
          source: 'Round 1 winners vs bye teams',
        },
        { label: 'Upper Round 3', expected: 2, flow: 'merge', source: 'Upper Round 2 winners' },
        {
          label: 'Upper Final',
          expected: 1,
          flow: 'end',
          source: 'Winner qualifies for Masters 1',
        },
      ],
    },
    {
      key: 'middle',
      title: 'Middle bracket',
      note: 'Every Upper Round 1 loser faces an Upper Round 2 loser. No byes.',
      rounds: [
        {
          label: 'Middle Round 1',
          expected: 4,
          flow: 'merge',
          source: 'Upper R1 losers vs Upper R2 losers',
        },
        {
          label: 'Middle Round 2',
          expected: 2,
          flow: 'straight',
          source: 'Middle Round 1 winners',
        },
        {
          label: 'Middle Round 3',
          expected: 2,
          flow: 'merge',
          source: 'Middle R2 winners vs Upper R3 losers',
        },
        {
          label: 'Middle Round 4',
          expected: 1,
          flow: 'straight',
          source: 'Middle Round 3 winners',
        },
        {
          label: 'Middle Final',
          expected: 1,
          flow: 'end',
          source: 'Middle R4 winner vs Upper Final loser',
        },
      ],
    },
    {
      key: 'lower',
      title: 'Lower bracket',
      note: 'A third loss eliminates a team. Every series is played; there are no byes.',
      rounds: [
        { label: 'Lower Round 1', expected: 2, flow: 'straight', source: 'Middle Round 1 losers' },
        {
          label: 'Lower Round 2',
          expected: 2,
          flow: 'straight',
          source: 'Lower R1 winners vs Middle R2 losers',
        },
        {
          label: 'Lower Round 3',
          expected: 2,
          flow: 'merge',
          source: 'Lower R2 winners vs Middle R3 losers',
        },
        { label: 'Lower Round 4', expected: 1, flow: 'straight', source: 'Lower Round 3 winners' },
        {
          label: 'Lower Round 5',
          expected: 1,
          flow: 'straight',
          source: 'Lower R4 winner vs Middle R4 loser',
        },
        {
          label: 'Lower Final',
          expected: 1,
          flow: 'end',
          source: 'Lower R5 winner vs Middle Final loser',
        },
      ],
    },
  ]
  return (
    <section className="kickoff-bracket">
      {paths.map((path) => {
        const laneCapacity = Math.max(...path.rounds.map((round) => round.expected))
        return (
          <section className={'kickoff-bracket-lane ' + path.key} key={path.key}>
            <header>
              <div>
                <b>{path.title}</b>
                <span>{path.note}</span>
              </div>
            </header>
            <div className="kickoff-bracket-scroll">
              <div className={'kickoff-bracket-rounds slots-' + laneCapacity}>
                {path.rounds.map((round) => {
                  const matches = fixtures.filter((fixture) => fixture.label === round.label)
                  const slots = Array.from({ length: round.expected }, (_, index) => matches[index])
                  const centerFor = (index: number) => ((index + 0.5) / round.expected) * 100
                  return (
                    <div className="kickoff-bracket-column" key={round.label}>
                      <h3 title={round.source}>
                        <span>{round.label.replace(/^(Upper|Middle|Lower) /, '')}</span>
                        <small>
                          {matches.length
                            ? matches.length + ' / ' + round.expected
                            : round.expected + (round.expected === 1 ? ' match' : ' matches')}
                        </small>
                      </h3>
                      <div className="kickoff-round-track">
                        {slots.map((fixture, slotIndex) => (
                          <div
                            className={'kickoff-match-node' + (fixture ? '' : ' placeholder-node')}
                            key={fixture?.id ?? round.label + '-placeholder-' + slotIndex}
                            style={{ top: centerFor(slotIndex) + '%' }}
                          >
                            {fixture ? (
                              <FixtureCard
                                s={s}
                                fixture={fixture}
                                compact
                                onOpenMatch={onOpenMatch}
                              />
                            ) : (
                              <div className="bracket-placeholder" title={round.source}>
                                <strong>TBD</strong>
                                <span>{round.source}</span>
                              </div>
                            )}
                          </div>
                        ))}
                        {round.flow !== 'end' &&
                          slots.map((_, slotIndex) => (
                            <span
                              className={
                                'kickoff-out-connector' + (round.flow === 'merge' ? ' is-half' : '')
                              }
                              key={round.label + '-out-' + slotIndex}
                              style={{ top: centerFor(slotIndex) + '%' }}
                            />
                          ))}
                        {round.flow === 'merge' &&
                          slots.map((_, slotIndex) => {
                            if (slotIndex % 2) return null
                            const start = centerFor(slotIndex)
                            const end = centerFor(Math.min(slotIndex + 1, slots.length - 1))
                            const mid = (start + end) / 2
                            return (
                              <span
                                className="kickoff-merge-group"
                                key={round.label + '-connector-' + slotIndex}
                              >
                                <span
                                  className="kickoff-merge-connector"
                                  style={{ top: start + '%', height: end - start + '%' }}
                                />
                                <span
                                  className="kickoff-join-connector"
                                  style={{ top: mid + '%' }}
                                />
                              </span>
                            )
                          })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )
      })}
    </section>
  )
}
type CompetitionTab = 'bracket' | 'opening' | 'standings' | 'matches'
function StandingsPanel({
  s,
  region,
  phase,
}: {
  s: GameState
  region: Region
  phase: 'Kickoff' | 'Stage 1' | 'Stage 2'
}) {
  return (
    <section className="panel standings-panel">
      <PanelTitle
        eyebrow={`${region} · ${phase}`}
        title={phase === 'Kickoff' ? 'Kickoff standings' : 'League table'}
        right={
          <Badge color={colors[region]}>
            {phase === 'Kickoff'
              ? '3 qualify'
              : `Top 8 playoffs · ${phase === 'Stage 1' ? 3 : 4} qualify`}
          </Badge>
        }
      />
      <TeamTable s={s} region={region} phase={phase} />
    </section>
  )
}
function KickoffInfo({ s, region }: { s: GameState; region: Region }) {
  const byes = Object.values(s.teams).filter(
    (team) => team.region === region && s.kickoff[team.id].openingBye,
  )
  return (
    <>
      <div className="format-explainer">
        <p>
          Win to move right. A first loss drops a team to the middle bracket, a second loss drops it
          to the lower bracket, and a third loss eliminates it. The winner of each path qualifies
          for Masters 1.
        </p>
        <div className="life-key">
          <span>Upper</span>
          <b>↓</b>
          <span>Middle</span>
          <b>↓</b>
          <span>Lower</span>
          <b>×</b>
          <span>Out</span>
        </div>
      </div>
      <h3 className="modal-subhead">Opening-round byes · {region}</h3>
      <div className="bye-list">
        {byes.map((team) => (
          <article key={team.id}>
            <i style={{ background: team.color }} />
            <strong>{team.name}</strong>
            <small>Enters Upper Round 2</small>
          </article>
        ))}
      </div>
    </>
  )
}
function fixtureRecord(id: string, fixtures: Fixture[]) {
  let wins = 0,
    losses = 0
  fixtures
    .filter((f) => f.status === 'completed' && (f.aId === id || f.bId === id))
    .forEach((f) => (f.winnerId === id ? wins++ : losses++))
  return { wins, losses }
}
const swissRoundOrder = ['Swiss Opening', 'Swiss Advancement', 'Swiss Elimination', 'Swiss Decider']
function SwissView({
  s,
  phase,
  fixtures,
  onOpenMatch,
}: {
  s: GameState
  phase: 'Masters 1' | 'Masters 2'
  fixtures: Fixture[]
  onOpenMatch?: (matchId: string) => void
}) {
  const source = phase === 'Masters 1' ? 'Kickoff' : 'Stage 1',
    direct = regions.map((region) =>
      phase === 'Masters 1'
        ? rankedTeams(
            s,
            Object.values(s.teams)
              .filter((team) => team.region === region)
              .map((team) => team.id),
            source,
          )[0]
        : regionalPlayoffQualifiers(s, 'Stage 1', region, 3)[0],
    )
  const swiss = fixtures.filter((f) => stageFor(f) === 'Swiss'),
    ids = [...new Set(swiss.flatMap((f) => (f.bId ? [f.aId, f.bId] : [f.aId])))]
  const ordered = [...ids].sort((a, b) => {
    const ar = fixtureRecord(a, swiss),
      br = fixtureRecord(b, swiss)
    return br.wins - ar.wins || ar.losses - br.losses
  })
  return (
    <div className="tournament-stage-grid">
      <section className="panel direct-seeds">
        <PanelTitle eyebrow="DIRECT PLAYOFF SEEDS" title="Regional champions" />
        <p>These four teams skip Swiss and enter the upper playoff bracket.</p>
        {direct.map((id) => {
          const team = s.teams[id]
          return (
            <article key={id}>
              <i style={{ background: team.color }} />
              <strong>{team.name}</strong>
              <small>{team.region} #1</small>
            </article>
          )
        })}
      </section>
      <section className="panel swiss-panel">
        <PanelTitle
          eyebrow="SWISS STAGE"
          title="Two wins advance. Two losses eliminate."
          right={<Badge>4 spots</Badge>}
        />
        <div className="swiss-table">
          {ordered.map((id, index) => {
            const team = s.teams[id],
              record = fixtureRecord(id, swiss),
              state = record.wins >= 2 ? 'Advanced' : record.losses >= 2 ? 'Eliminated' : 'In play'
            return (
              <article className={id === s.currentTeamId ? 'managed' : ''} key={id}>
                <b>{index + 1}</b>
                <i style={{ background: team.color }} />
                <span>
                  <strong>{team.name}</strong>
                  <small>{team.region}</small>
                </span>
                <em>
                  {record.wins}–{record.losses}
                </em>
                <Badge
                  color={
                    state === 'Advanced'
                      ? tone.accent
                      : state === 'Eliminated'
                        ? tone.neg
                        : tone.muted
                  }
                >
                  {state}
                </Badge>
              </article>
            )
          })}
          {!ordered.length && (
            <div className="competition-empty">
              <strong>Swiss draw pending</strong>
              <span>The eight non-champion seeds appear here when the event begins.</span>
            </div>
          )}
        </div>
      </section>
      <section className="panel swiss-results">
        <PanelTitle
          eyebrow="SWISS RESULTS"
          title="Stage games played"
          right={
            <Badge>
              {swiss.filter((fixture) => fixture.status === 'completed').length} / {swiss.length}
            </Badge>
          }
        />
        {swiss.length ? (
          swissRoundOrder
            .map((label) => ({
              label,
              matches: swiss.filter((fixture) => fixture.label === label),
            }))
            .filter((round) => round.matches.length)
            .map((round) => (
              <div className="swiss-result-round" key={round.label}>
                <h3>
                  {round.label.replace('Swiss ', '')}
                  <small>
                    {round.matches.filter((fixture) => fixture.status === 'completed').length} of{' '}
                    {round.matches.length} complete
                  </small>
                </h3>
                <div className="matchup-list">
                  {round.matches.map((fixture) => (
                    <FixtureCard
                      s={s}
                      fixture={fixture}
                      compact
                      onOpenMatch={onOpenMatch}
                      key={fixture.id}
                    />
                  ))}
                </div>
              </div>
            ))
        ) : (
          <div className="competition-empty">
            <strong>No Swiss results yet</strong>
            <span>Completed Swiss series appear here as the stage is played.</span>
          </div>
        )}
      </section>
    </div>
  )
}
const bracketColumns = [
  { key: 'Upper Quarterfinal', title: 'Quarterfinals', lane: 'upper' },
  { key: 'Upper Semifinal', title: 'Semifinals', lane: 'upper' },
  { key: 'Upper Final', title: 'Upper final', lane: 'upper' },
  { key: 'Lower Round 1', title: 'Round 1', lane: 'lower' },
  { key: 'Lower Round 2', title: 'Round 2', lane: 'lower' },
  { key: 'Lower Round 3', title: 'Round 3', lane: 'lower' },
  { key: 'Lower Final', title: 'Lower final', lane: 'lower' },
] as const
function PlayoffBracket({
  s,
  fixtures,
  onOpenMatch,
}: {
  s: GameState
  fixtures: Fixture[]
  onOpenMatch?: (matchId: string) => void
}) {
  const playoff = fixtures.filter((f) => stageFor(f) === 'Playoffs'),
    final = playoff.find((f) => f.label === 'Grand Final')
  const lane = (name: 'upper' | 'lower') => (
    <section className={`bracket-lane ${name}`}>
      <header>
        <div>
          <b>{name === 'upper' ? 'Upper bracket' : 'Lower bracket'}</b>
          <span>
            {name === 'upper'
              ? 'A loss moves a team to the lower path'
              : 'Every series is elimination'}
          </span>
        </div>
      </header>
      <div className="bracket-path">
        {bracketColumns
          .filter((c) => c.lane === name)
          .map((column) => {
            const matches = playoff.filter((f) => f.label === column.key)
            return (
              <div className="bracket-step" key={column.key}>
                <h3>
                  {column.title}
                  <small>{matches.length || '—'} matches</small>
                </h3>
                {matches.length ? (
                  matches.map((f) => (
                    <FixtureCard s={s} fixture={f} compact onOpenMatch={onOpenMatch} key={f.id} />
                  ))
                ) : (
                  <div className="bracket-placeholder">
                    <strong>Awaiting teams</strong>
                    <span>Previous results fill this round.</span>
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </section>
  )
  return (
    <section className="playoff-board">
      <div className="bracket-legend">
        <span>
          <i />
          Upper path
        </span>
        <span>
          <i />
          Elimination path
        </span>
      </div>
      {lane('upper')}
      {lane('lower')}
      <div className="grand-final">
        <div>
          <div className="eyebrow">TITLE MATCH</div>
          <h2>Grand final</h2>
          <p>The upper-bracket winner meets the survivor of the lower bracket.</p>
        </div>
        {final ? (
          <FixtureCard s={s} fixture={final} featured onOpenMatch={onOpenMatch} />
        ) : (
          <div className="bracket-placeholder">
            <strong>Finalists not decided</strong>
            <span>The title match appears when both paths finish.</span>
          </div>
        )}
      </div>
    </section>
  )
}
const groupColumns = [
  {
    title: 'Opening',
    note: '2 matches',
    slots: [{ label: 'Opening', pending: 'Seeds 1v4 and 2v3 meet first.' }],
  },
  {
    title: 'Round 2',
    note: 'Winners · Elimination',
    slots: [
      { label: 'Winners', pending: 'Opening winners meet. The winner advances as 1st.' },
      { label: 'Elimination', pending: 'Opening losers meet. The loser is eliminated.' },
    ],
  },
  {
    title: 'Decider',
    note: 'Winner advances 2nd',
    slots: [{ label: 'Decider', pending: 'Winners loser meets the Elimination winner.' }],
  },
] as const
function ChampionsGroups({
  s,
  fixtures,
  onOpenMatch,
}: {
  s: GameState
  fixtures: Fixture[]
  onOpenMatch?: (matchId: string) => void
}) {
  return (
    <section className="panel">
      <PanelTitle
        eyebrow="CHAMPIONS GROUP STAGE"
        title="Four double-elimination groups"
        right={<Badge>Top 2 advance</Badge>}
      />
      <div className="group-grid">
        {(['A', 'B', 'C', 'D'] as const).map((group) => {
          const matches = fixtures.filter((f) => f.group === group)
          return (
            <article className="group-card" key={group}>
              <header>
                <strong>Group {group}</strong>
                <small>{matches.filter((f) => f.status === 'completed').length} of 5 played</small>
              </header>
              <div className="bracket-path group-bracket">
                {groupColumns.map((column) => (
                  <div className="bracket-step" key={column.title}>
                    <h3>
                      {column.title}
                      <small>{column.note}</small>
                    </h3>
                    {column.slots.map((slot) => {
                      const slotMatches = matches.filter((f) => f.label.endsWith(slot.label))
                      return slotMatches.length ? (
                        slotMatches.map((f) => (
                          <FixtureCard
                            s={s}
                            fixture={f}
                            compact
                            onOpenMatch={onOpenMatch}
                            key={f.id}
                          />
                        ))
                      ) : (
                        <div className="bracket-placeholder" key={slot.label}>
                          <strong>{slot.label} match</strong>
                          <span>{slot.pending}</span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
const tabsFor = (phase: PlayablePhase): Array<[CompetitionTab, string]> =>
  phase === 'Kickoff'
    ? [
        ['bracket', 'Bracket'],
        ['standings', 'Standings'],
        ['matches', 'Matches'],
      ]
    : phase === 'Stage 1' || phase === 'Stage 2'
      ? [
          ['standings', 'League table'],
          ['bracket', 'Regional playoffs'],
          ['matches', 'Matches'],
        ]
      : [
          ['opening', phase === 'Champions' ? 'Group stage' : 'Swiss stage'],
          ['bracket', 'Playoff bracket'],
          ['matches', 'Matches'],
        ]
const defaultTab = (s: GameState, phase: PlayablePhase): CompetitionTab =>
  phase === 'Kickoff'
    ? 'bracket'
    : s.week >= playoffStartFor(phase)
      ? 'bracket'
      : phase === 'Stage 1' || phase === 'Stage 2'
        ? 'standings'
        : 'opening'

export function CompetitionV2({
  s,
  onOpenMatch,
  onSimMatch,
  onSimulateRound,
  initialTab,
}: {
  s: GameState
  onOpenMatch?: (matchId: string) => void
  onSimMatch?: (fixtureId: string) => void
  onSimulateRound?: () => void
  initialTab?: CompetitionTab
}) {
  const active = activePhaseForWeek(s.week),
    initial = (active === 'Offseason' ? 'Champions' : active) as PlayablePhase
  const [phase, setPhase] = useState<PlayablePhase>(initial),
    [region, setRegion] = useState<Region>(currentTeam(s).region),
    [week, setWeek] = useState(
      Math.max(events[initial].start, Math.min(events[initial].end, s.week)),
    ),
    [tab, setTab] = useState<CompetitionTab>(initialTab ?? defaultTab(s, initial)),
    [showInfo, setShowInfo] = useState(false)
  const info = events[phase],
    status = statusFor(s, phase),
    isCurrentEvent = phase === activePhaseForWeek(s.week) && phaseForWeek(s.week) !== 'Break',
    regional = info.type === 'regional',
    currentRoundFixtures = liveTournamentRoundFixtures(s, phase, regional ? region : undefined),
    simMatch = {
      playable: new Set(isCurrentEvent ? playableTournamentFixtureIds(s) : []),
      onSimMatch,
    },
    selectEvent = (next: PlayablePhase) => {
      setPhase(next)
      setWeek(Math.max(events[next].start, Math.min(events[next].end, s.week)))
      setTab(defaultTab(s, next))
    }
  const eventFixtures = s.fixtures.filter(
    (fixture) =>
      fixture.season === s.season &&
      fixture.phase === phase &&
      (regional ? fixture.region === region : fixture.scope === 'international'),
  )
  const weekFixtures = fixturesForWeek(s, week).filter(
    (fixture) =>
      fixture.phase === phase &&
      (regional ? fixture.region === region : fixture.scope === 'international'),
  )
  const matchday = <Matchday week={week} setWeek={setWeek} min={info.start} max={info.end} />
  const body =
    tab === 'matches' ? (
      regional ? (
        <Schedule
          onOpenMatch={onOpenMatch}
          s={s}
          fixtures={weekFixtures}
          title={`${region} · week ${week} matchups`}
          controls={matchday}
          empty="No series for this region in the selected week."
        />
      ) : (
        <Schedule
          onOpenMatch={onOpenMatch}
          s={s}
          fixtures={currentTournamentDeskFixtures(s, phase)}
          title={`${phase} · current matchups`}
          empty={
            s.week < info.start
              ? 'The qualified field appears when the event begins.'
              : 'This round is complete. Advance when you are ready for the next round.'
          }
        />
      )
    ) : tab === 'standings' &&
      phase !== 'Masters 1' &&
      phase !== 'Masters 2' &&
      phase !== 'Champions' ? (
      <StandingsPanel s={s} region={region} phase={phase} />
    ) : tab === 'opening' && phase === 'Champions' ? (
      <ChampionsGroups
        onOpenMatch={onOpenMatch}
        s={s}
        fixtures={eventFixtures.filter((f) => stageFor(f) === 'Groups')}
      />
    ) : tab === 'opening' && (phase === 'Masters 1' || phase === 'Masters 2') ? (
      <SwissView onOpenMatch={onOpenMatch} s={s} phase={phase} fixtures={eventFixtures} />
    ) : phase === 'Kickoff' ? (
      <KickoffBracket s={s} fixtures={eventFixtures} onOpenMatch={onOpenMatch} />
    ) : (
      <PlayoffBracket onOpenMatch={onOpenMatch} s={s} fixtures={eventFixtures} />
    )
  const page = (
    <div className="page competition-hub">
      <div className="comp-head">
        <h1>Competition</h1>
        <nav className="event-rail">
          {eventOrder.map((event) => (
            <button
              className={phase === event ? 'active' : ''}
              onClick={() => selectEvent(event)}
              key={event}
              title={`${events[event].location} · ${statusFor(s, event)}`}
            >
              <i className={statusFor(s, event).toLowerCase().replace(' ', '-')} />
              {event}
            </button>
          ))}
        </nav>
      </div>
      <div className="comp-toolbar">
        <div className="event-summary">
          <strong title={status}>
            {phase} · {regional ? region : info.location}
          </strong>
          <button className="link" onClick={() => setShowInfo(true)}>
            <Info size={14} /> Info
          </button>
        </div>
        {regional && <RegionPicker region={region} setRegion={setRegion} />}
        <div className="tabs comp-tabs">
          {tabsFor(phase).map(([key, label]) => (
            <button className={tab === key ? 'active' : ''} onClick={() => setTab(key)} key={key}>
              {label}
            </button>
          ))}
        </div>
        {isCurrentEvent && (
          <div className="live-round">
            <span
              title={
                [...new Set(currentRoundFixtures.map((fixture) => fixture.label))].join(' · ') ||
                'Round complete'
              }
            >
              <strong>
                {currentRoundFixtures.length
                  ? `${currentRoundFixtures.length} left this round`
                  : 'Round complete'}
              </strong>
            </span>
            <button className="primary compact" onClick={onSimulateRound}>
              Simulate round
            </button>
          </div>
        )}
      </div>
      <div className="comp-body">{body}</div>
      {showInfo && (
        <Modal
          eyebrow={`${info.type === 'international' ? info.location : region} · ${dateForWeek(info.start)} – ${dateForWeek(info.end)}`}
          title={`${phase}: ${info.format}`}
          onClose={() => setShowInfo(false)}
        >
          <p className="modal-lead">
            <strong>At stake:</strong> {info.stakes}.
          </p>
          {phase === 'Kickoff' ? (
            <KickoffInfo s={s} region={region} />
          ) : regional ? (
            <p className="muted">
              A round-robin league stage sets the table. The top eight reach a double-elimination
              playoff, and the best finishers qualify for the next international event.
            </p>
          ) : (
            <p className="muted">
              {phase === 'Champions'
                ? 'Four double-elimination groups of four. The top two from each group reach the playoff bracket.'
                : 'The four regional champions go straight to the playoffs. Eight more teams play a Swiss stage: two wins advance, two losses eliminate.'}
            </p>
          )}
        </Modal>
      )}
    </div>
  )
  return <SimMatchContext.Provider value={simMatch}>{page}</SimMatchContext.Provider>
}
