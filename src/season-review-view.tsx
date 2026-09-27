import { useState } from 'react'
import { Crown, Trophy } from 'lucide-react'
import type { GameState } from './game'
import {
  eventName,
  type LeagueReview,
  type ReviewEvent,
  type ReviewPlayer,
  type SeasonReview,
} from './season-review'
import type { Region } from './seed'
import { Badge, Modal, Stat, TeamMark, regionColors, tone } from './ui'

type Tab = 'overview' | 'events' | Region

const regions: Region[] = ['Americas', 'EMEA', 'Pacific', 'China']

const TeamName = ({ s, id }: { s: GameState; id?: string }) =>
  id && s.teams[id] ? (
    <span className="review-team">
      <TeamMark s={s} id={id} size="sm" />
      <strong>{s.teams[id].name}</strong>
    </span>
  ) : (
    <span className="review-team muted">Not played</span>
  )

function PlayerCard({
  s,
  label,
  player,
  highlight = false,
}: {
  s: GameState
  label: string
  player: ReviewPlayer | null
  highlight?: boolean
}) {
  return (
    <div className={`review-mvp ${highlight ? 'highlight' : ''}`}>
      <small>
        <Crown size={13} /> {label}
      </small>
      {player ? (
        <>
          <div className="review-mvp-name">
            {s.teams[player.teamId] && <TeamMark s={s} id={player.teamId} size="sm" />}
            <strong>{player.name}</strong>
            <span>
              {s.teams[player.teamId]?.short ?? ''} · {player.role}
            </span>
          </div>
          <div className="review-mvp-line">
            <span>
              <b>{player.acs}</b> ACS
            </span>
            <span>
              <b>{player.kd.toFixed(2)}</b> K/D
            </span>
            <span>
              <b>{player.kills}</b> kills
            </span>
            <span>
              <b>{player.maps}</b> maps
            </span>
          </div>
        </>
      ) : (
        <p className="review-empty">No maps played this season.</p>
      )}
    </div>
  )
}

function Overview({ s, review }: { s: GameState; review: SeasonReview }) {
  const { record } = review
  const titles = review.events.filter(
    (event) => event.podium[0] === review.teamId && event.phase !== 'Kickoff',
  )
  return (
    <div className="review-overview">
      <div className="stats review-stats">
        <Stat
          label="Series record"
          value={`${record.wins}–${record.losses}`}
          detail={
            record.wins + record.losses
              ? `${Math.round((record.wins / (record.wins + record.losses)) * 100)}% won`
              : 'No series'
          }
          accent
        />
        <Stat
          label="Maps"
          value={`${record.mapWins}–${record.mapLosses}`}
          detail={`${record.mapWins - record.mapLosses >= 0 ? '+' : ''}${record.mapWins - record.mapLosses} map difference`}
        />
        <Stat
          label="Champ points"
          value={`${review.championshipPoints}`}
          detail="Earned in the season"
        />
        <Stat
          label="Titles"
          value={`${titles.length}`}
          detail={titles.length ? titles.map(eventName).join(', ') : 'No trophies this year'}
        />
      </div>
      <div className="review-grid">
        <section className="review-card">
          <h3>Event by event</h3>
          <ul className="review-placements">
            {review.placements.map(({ phase, place }) => (
              <li key={phase}>
                <span>{phase}</span>
                <Badge
                  color={
                    place === '1st' || place === 'Masters seed #1'
                      ? tone.accent
                      : /Did not|Eliminated|stage/.test(place)
                        ? tone.muted
                        : tone.pos
                  }
                >
                  {place}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
        <section className="review-card">
          <PlayerCard s={s} label="Team MVP" player={review.teamMvp} highlight />
          <h3>Key players</h3>
          <ul className="review-players">
            {review.keyPlayers.map((player) => (
              <li key={player.playerId}>
                <span>
                  <strong>{player.name}</strong>
                  <small>{player.role}</small>
                </span>
                <span className="review-num">{player.acs} ACS</span>
                <span className="review-num">{player.kd.toFixed(2)} K/D</span>
                <span className="review-num">{player.maps} maps</span>
              </li>
            ))}
            {!review.keyPlayers.length && <li className="review-empty">No other regulars.</li>}
          </ul>
        </section>
      </div>
    </div>
  )
}

function Events({ s, review }: { s: GameState; review: SeasonReview }) {
  const international = review.events.filter((event) => !event.region)
  const regional = (phase: ReviewEvent['phase'], region: Region) =>
    review.events.find((event) => event.phase === phase && event.region === region)
  return (
    <div className="review-events">
      <PlayerCard s={s} label="Global MVP" player={review.globalMvp} highlight />
      <div className="review-international">
        {international.map((event) => (
          <div className="review-card review-trophy" key={event.phase}>
            <small>
              <Trophy size={13} /> {event.phase}
            </small>
            <TeamName s={s} id={event.podium[0]} />
            {event.podium[1] && (
              <span className="review-runner-up">
                Runner-up: {s.teams[event.podium[1]]?.name ?? '—'}
              </span>
            )}
          </div>
        ))}
      </div>
      <table className="review-table">
        <thead>
          <tr>
            <th>League winners</th>
            {regions.map((region) => (
              <th key={region} style={{ color: regionColors[region] }}>
                {region}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(['Kickoff', 'Stage 1', 'Stage 2'] as const).map((phase) => (
            <tr key={phase}>
              <td>{phase === 'Kickoff' ? 'Kickoff (top seed)' : phase}</td>
              {regions.map((region) => (
                <td key={region}>
                  <TeamName s={s} id={regional(phase, region)?.podium[0]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Podium({
  s,
  title,
  ids,
  labels,
}: {
  s: GameState
  title: string
  ids: string[]
  labels: string[]
}) {
  return (
    <section className="review-card">
      <h3>{title}</h3>
      <ol className="review-podium">
        {ids.length ? (
          ids.map((id, index) => (
            <li key={id}>
              <small>{labels[index] ?? `${index + 1}th`}</small>
              <TeamName s={s} id={id} />
            </li>
          ))
        ) : (
          <li className="review-empty">Not completed</li>
        )}
      </ol>
    </section>
  )
}

function League({ s, league }: { s: GameState; league: LeagueReview }) {
  const places = ['1st', '2nd', '3rd', '4th']
  return (
    <div className="review-league">
      <div className="review-league-grid">
        <Podium
          s={s}
          title="Kickoff"
          ids={league.kickoff}
          labels={['Seed #1', 'Seed #2', 'Seed #3']}
        />
        <Podium s={s} title="Stage 1" ids={league.stage1} labels={places} />
        <Podium s={s} title="Stage 2" ids={league.stage2} labels={places} />
        <Podium
          s={s}
          title="Champions spots"
          ids={league.champions}
          labels={['Stage 2 winner', 'Stage 2 runner-up', 'Points #1', 'Points #2']}
        />
      </div>
      <div className="review-grid">
        <section className="review-card">
          <h3>Championship Points</h3>
          <table className="review-table compact">
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th>W–L</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {league.points.map((row, index) => (
                <tr key={row.teamId} className={row.teamId === s.currentTeamId ? 'current' : ''}>
                  <td>{index + 1}</td>
                  <td>
                    <TeamName s={s} id={row.teamId} />
                  </td>
                  <td>
                    {row.wins}–{row.losses}
                  </td>
                  <td>
                    <b>{row.points}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <PlayerCard s={s} label={`${league.region} MVP`} player={league.mvp} />
      </div>
    </div>
  )
}

/** The season recap: your team, awards, event winners and a page per league. */
export function YearInReview({
  s,
  season,
  onClose,
}: {
  s: GameState
  season?: number
  onClose: () => void
}) {
  const reviews = s.reviews ?? []
  const [picked, setPicked] = useState(season ?? reviews[0]?.season)
  const [tab, setTab] = useState<Tab>('overview')
  const review = reviews.find((entry) => entry.season === picked) ?? reviews[0]
  if (!review) return null
  const team = s.teams[review.teamId]
  const league = regions.includes(tab as Region)
    ? review.leagues.find((entry) => entry.region === tab)
    : undefined
  return (
    <Modal
      eyebrow={`SEASON ${review.season} · YEAR IN REVIEW`}
      title={team ? `${team.name} · ${review.season} season` : `Season ${review.season}`}
      onClose={onClose}
      wide
    >
      <div className="review-head">
        <div className="tabs">
          {(
            [
              ['overview', 'Your year'],
              ['events', 'Awards & winners'],
              ...regions.map((region) => [region, region]),
            ] as Array<[Tab, string]>
          ).map(([value, label]) => (
            <button
              className={tab === value ? 'active' : ''}
              onClick={() => setTab(value)}
              key={value}
            >
              {label}
            </button>
          ))}
        </div>
        {reviews.length > 1 && (
          <select
            aria-label="Review season"
            value={review.season}
            onChange={(event) => setPicked(Number(event.target.value))}
          >
            {reviews.map((entry) => (
              <option value={entry.season} key={entry.season}>
                Season {entry.season}
              </option>
            ))}
          </select>
        )}
      </div>
      {tab === 'overview' && <Overview s={s} review={review} />}
      {tab === 'events' && <Events s={s} review={review} />}
      {league && <League s={s} league={league} />}
      <div className="modal-actions">
        <button className="primary" onClick={onClose}>
          {s.pendingReview === review.season ? `On to ${review.season + 1}` : 'Close'}
        </button>
      </div>
    </Modal>
  )
}
