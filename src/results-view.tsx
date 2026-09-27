import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { dateForWeek, type Fixture, type GameState, type MatchResult } from './game'
import { BoxScoreModal } from './game-views'
import { Badge, Empty, Page, PanelTitle, Stat, TeamMark, regionColors, tone } from './ui'

export type TeamResult = {
  match: MatchResult
  fixture?: Fixture
  won: boolean
  opponentId: string
  /** Maps won and lost from the managed team's side. */
  mapsFor: number
  mapsAgainst: number
}

/** Every series a team played in one season, newest first, with its event and round. */
export function seasonResults(s: GameState, season: number, teamId = s.currentTeamId) {
  const fixtures = new Map(
    s.fixtures
      .filter((fixture) => fixture.season === season)
      .map((fixture) => [fixture.id, fixture]),
  )
  return s.matches
    .map((match, index) => ({ match, index }))
    .filter(
      ({ match }) => match.season === season && (match.aId === teamId || match.bId === teamId),
    )
    .sort((left, right) => right.match.week - left.match.week || left.index - right.index)
    .map(({ match }): TeamResult => {
      const home = match.aId === teamId
      return {
        match,
        fixture: match.fixtureId ? fixtures.get(match.fixtureId) : undefined,
        won: match.winnerId === teamId,
        opponentId: home ? match.bId : match.aId,
        mapsFor: home ? match.aScore : match.bScore,
        mapsAgainst: home ? match.bScore : match.aScore,
      }
    })
}

/** Events in calendar order with the team's series record in each. */
export function eventRecords(results: TeamResult[]) {
  const events = new Map<string, { event: string; wins: number; losses: number; first: number }>()
  results.forEach(({ match, won }) => {
    const entry = events.get(match.phase) ?? {
      event: match.phase,
      wins: 0,
      losses: 0,
      first: match.week,
    }
    entry.wins += won ? 1 : 0
    entry.losses += won ? 0 : 1
    entry.first = Math.min(entry.first, match.week)
    events.set(match.phase, entry)
  })
  return [...events.values()].sort((left, right) => left.first - right.first)
}

const roundLabel = (fixture: Fixture | undefined) => {
  if (!fixture) return ''
  const parts = [
    fixture.group ? `Group ${fixture.group}` : fixture.stage === 'Swiss' ? 'Swiss' : '',
    // Group and league matchdays are labelled "Week N"; call them rounds so they
    // don't read like calendar weeks.
    fixture.label.replace(/^Week (\d+)$/, 'Round $1'),
  ]
  return parts.filter(Boolean).join(' · ')
}

export function Results({
  s,
  onOpenFull,
  initialSeason,
}: {
  s: GameState
  onOpenFull: (id: string) => void
  initialSeason?: number
}) {
  const team = s.teams[s.currentTeamId]
  const seasons = [...new Set([s.season, ...s.matches.map((match) => match.season)])].sort(
    (a, b) => b - a,
  )
  const [season, setSeason] = useState(initialSeason ?? s.season)
  const [event, setEvent] = useState('All')
  const [openId, setOpenId] = useState<string>()
  const results = seasonResults(s, season)
  const events = eventRecords(results)
  const shown = event === 'All' ? results : results.filter(({ match }) => match.phase === event)
  const wins = results.filter((result) => result.won).length
  const mapsFor = results.reduce((sum, result) => sum + result.mapsFor, 0),
    mapsAgainst = results.reduce((sum, result) => sum + result.mapsAgainst, 0)
  const rounds = results.reduce(
    (sum, { match }) => {
      const home = match.aId === s.currentTeamId
      match.maps.forEach((map) => {
        sum.for += home ? map.aScore : map.bScore
        sum.against += home ? map.bScore : map.aScore
      })
      return sum
    },
    { for: 0, against: 0 },
  )
  const opened = openId ? results.find(({ match }) => match.id === openId) : undefined
  const pickSeason = (value: number) => {
    setSeason(value)
    setEvent('All')
  }
  return (
    <Page
      eyebrow="MATCHDAY / RESULTS"
      title="Season results"
      subtitle={`Every series ${team.name} played, by event. Click a series for its box score.`}
      actions={
        seasons.length > 1 && (
          <select
            aria-label="Season"
            value={season}
            onChange={(e) => pickSeason(Number(e.target.value))}
          >
            {seasons.map((value) => (
              <option value={value} key={value}>
                Season {value}
                {value === s.season ? ' (current)' : ''}
              </option>
            ))}
          </select>
        )
      }
    >
      {results.length === 0 ? (
        <Empty
          title="No series played yet"
          body={
            season === s.season
              ? 'Press Continue to play your first series. Results for the whole year will build up here.'
              : 'Your team did not play in this season.'
          }
        />
      ) : (
        <>
          <div className="stats results-stats">
            <Stat
              label="Series record"
              value={`${wins}–${results.length - wins}`}
              detail={`${Math.round((wins / results.length) * 100)}% won`}
              accent
            />
            <Stat
              label="Maps"
              value={`${mapsFor}–${mapsAgainst}`}
              detail={`${mapsFor - mapsAgainst >= 0 ? '+' : ''}${mapsFor - mapsAgainst} map difference`}
            />
            <Stat
              label="Rounds"
              value={`${rounds.for}–${rounds.against}`}
              detail={`${rounds.for - rounds.against >= 0 ? '+' : ''}${rounds.for - rounds.against} round difference`}
            />
            <Stat
              label="Events"
              value={`${events.length}`}
              detail={`${events.filter((entry) => results.some(({ match, fixture }) => match.phase === entry.event && fixture?.scope === 'international')).length} international`}
            />
          </div>
          <div className="results-grid">
            <section className="panel results-list-panel">
              <PanelTitle
                eyebrow={`SEASON ${season}`}
                title={event === 'All' ? 'All series' : event}
                right={<Badge>{shown.length} series</Badge>}
              />
              <div className="tabs results-filter">
                {['All', ...events.map((entry) => entry.event)].map((name) => (
                  <button
                    className={event === name ? 'active' : ''}
                    onClick={() => setEvent(name)}
                    key={name}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="results-list" role="list">
                {shown.map((result) => {
                  const { match, fixture, won, opponentId } = result
                  const opponent = s.teams[opponentId]
                  const home = match.aId === s.currentTeamId
                  return (
                    <button
                      className="results-row"
                      role="listitem"
                      onClick={() => setOpenId(match.id)}
                      key={match.id}
                    >
                      <span className={`result-tag ${won ? 'w' : 'l'}`}>{won ? 'W' : 'L'}</span>
                      <span className="results-when">
                        <strong>Week {match.week}</strong>
                        <small>{dateForWeek(match.week)}</small>
                      </span>
                      <span className="results-event">
                        <strong>{match.phase}</strong>
                        <small>
                          {roundLabel(fixture) || `Best of ${match.bestOf}`}
                          {fixture?.scope === 'international' ? ' · International' : ''}
                        </small>
                      </span>
                      <span className="results-opponent">
                        <small>vs</small>
                        <TeamMark s={s} id={opponentId} size="sm" />
                        <strong>{opponent?.name ?? opponentId}</strong>
                      </span>
                      <b className={`results-score ${won ? 'w' : 'l'}`}>
                        {result.mapsFor}–{result.mapsAgainst}
                      </b>
                      <span className="results-maps">
                        {match.maps.map((map, index) => {
                          const own = home ? map.aScore : map.bScore,
                            other = home ? map.bScore : map.aScore
                          return (
                            <span
                              className={map.winnerId === s.currentTeamId ? 'w' : 'l'}
                              key={`${map.map}-${index}`}
                            >
                              {map.map} {own}–{other}
                            </span>
                          )
                        })}
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  )
                })}
              </div>
            </section>
            <section className="panel results-events">
              <PanelTitle eyebrow="BY EVENT" title="Event records" />
              {events.map((entry) => {
                const played = results.filter(({ match }) => match.phase === entry.event)
                const international = played.some(
                  ({ fixture }) => fixture?.scope === 'international',
                )
                const last = played[0]
                return (
                  <button
                    className={`results-event-row ${event === entry.event ? 'active' : ''}`}
                    onClick={() => setEvent(event === entry.event ? 'All' : entry.event)}
                    key={entry.event}
                  >
                    <span>
                      <strong>{entry.event}</strong>
                      <small>
                        {played.length} series · latest:{' '}
                        {roundLabel(last?.fixture) || `week ${last?.match.week}`}
                      </small>
                    </span>
                    <Badge color={international ? tone.accent : regionColors[team.region]}>
                      {entry.wins}–{entry.losses}
                    </Badge>
                  </button>
                )
              })}
            </section>
          </div>
        </>
      )}
      {opened && (
        <BoxScoreModal
          s={s}
          match={opened.match}
          eyebrow={[
            opened.match.phase,
            roundLabel(opened.fixture),
            `Week ${opened.match.week}`,
            `Bo${opened.match.bestOf}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          onClose={() => setOpenId(undefined)}
          onOpenFull={onOpenFull}
        />
      )}
    </Page>
  )
}
