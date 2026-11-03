import type { GameState, Player, TransferRecord } from './game'
import {
  careerAcs,
  clubStints,
  contractHistory,
  honours,
  ratingsRevealed,
  SCOUT_REVEAL,
} from './player-card'
import { hasTrialed, scoutRange } from './scouting'
import { skills } from './seed'
import { playerOverall } from './transfers'
import { Badge, Modal, money, Stat, tone } from './ui'

const seasonSpan = (from: number, to: number) => (from === to ? `${from}` : `${from}–${to}`)

function describeMove(s: GameState, move: TransferRecord) {
  const from = move.fromTeamId ? (s.teams[move.fromTeamId]?.short ?? 'Unknown') : 'Free agency'
  const to = move.toTeamId ? (s.teams[move.toTeamId]?.short ?? 'Unknown') : 'Free agency'
  if (move.kind === 'status') return move.note ?? `Status changed at ${from}`
  if (move.kind === 'release') return `Released by ${from}`
  if (move.kind === 'expiry') return `Contract with ${from} expired`
  if (move.kind === 'renewal') return `Re-signed with ${from}${move.note ? ` · ${move.note}` : ''}`
  if (move.kind === 'retirement') return `Retired from ${from}`
  if (move.kind === 'signing') return `Signed by ${to}${move.fee ? ` · ${money(move.fee)}` : ''}`
  return `${from} → ${to} · ${money(move.fee)}`
}

/** Pop-up overview of one player: ratings, contract, and everything the career log knows. */
export function PlayerCard({
  s,
  playerId,
  onClose,
}: {
  s: GameState
  playerId: string
  onClose: () => void
}) {
  const player = s.players[playerId]
  if (!player) return null
  return (
    <Modal
      wide
      eyebrow={`PLAYER CARD · ${player.teamId ? (s.teams[player.teamId]?.short ?? '') : 'FREE AGENT'}`}
      title={player.name}
      onClose={onClose}
    >
      <PlayerCardBody s={s} player={player} />
    </Modal>
  )
}

function PlayerCardBody({ s, player }: { s: GameState; player: Player }) {
  const revealed = ratingsRevealed(s, player)
  const overall = playerOverall(player)
  const acs = careerAcs(player)
  const seasonsPlayed = (player.career ?? []).filter((entry) => entry.maps > 0).length
  const stints = clubStints(s, player).reverse()
  const terms = contractHistory(s, player).reverse()
  const awards = honours(player)
  const moves = (s.transfers ?? []).filter((move) => move.playerId === player.id).slice(0, 8)
  const hidden = '??'
  // Ladder prospects show their overall as a scouting range until a trial reveals it.
  const range = player.ladder && !revealed ? scoutRange(player) : null
  const trialed = hasTrialed(s, player.id)

  return (
    <div className="player-card">
      <div className="player-card-stats stats">
        <Stat
          label="Overall"
          value={revealed ? `${overall}` : range ? `${range.low}–${range.high}` : hidden}
          detail={`${player.primaryRole}${player.igl ? ' · IGL' : ''} · Age ${player.age}`}
          accent
        />
        <Stat
          label="Potential"
          value={revealed ? `${player.potential}` : hidden}
          detail={revealed ? 'Ceiling' : `Scouted ${Math.round(player.scoutProgress)}%`}
        />
        <Stat
          label="Contract"
          value={money(player.salary)}
          detail={`per year · ${player.years}y left${player.renewal ? ` · re-signing ${player.renewal.years}y` : ''}`}
        />
        <Stat
          label="Career ACS"
          value={acs === null ? '—' : `${acs}`}
          detail={
            seasonsPlayed
              ? `${seasonsPlayed} season${seasonsPlayed === 1 ? '' : 's'} played`
              : 'No seasons completed'
          }
        />
      </div>

      <div className="player-card-grid">
        <section>
          <div className="eyebrow">RATINGS</div>
          {!revealed && (
            <p className="muted player-card-note">
              {player.ladder
                ? trialed
                  ? 'Trial complete. Offer a contract or let them go on the scouting page.'
                  : 'Invite this player to a trial to read their exact ratings and potential.'
                : `Scout this player to ${SCOUT_REVEAL}% to read their ratings and potential.`}
            </p>
          )}
          <div className="rating-list">
            {skills.map((skill) => {
              const value = player.ratings[skill]
              return (
                <div className="rating-row" key={skill}>
                  <span>{skill}</span>
                  <div
                    className="rating-scale"
                    role="meter"
                    aria-label={`${skill} rating`}
                    aria-valuemin={1}
                    aria-valuemax={100}
                    aria-valuenow={revealed ? value : undefined}
                  >
                    <i style={{ width: revealed ? `${value}%` : '0%' }} />
                  </div>
                  <b>{revealed ? value : hidden}</b>
                </div>
              )
            })}
          </div>
          <small className="rating-legend">Each rating runs from 1 to 100.</small>
        </section>

        <section>
          <div className="eyebrow">CLUBS</div>
          {stints.length ? (
            <ul className="card-list">
              {stints.map((stint) => (
                <li key={`${stint.teamId}-${stint.from}`}>
                  <span>
                    <strong>{s.teams[stint.teamId]?.name ?? 'Unknown club'}</strong>
                    <small>Season {seasonSpan(stint.from, stint.to)}</small>
                  </span>
                  {stint.teamId === player.teamId && stint.to === s.season && (
                    <Badge color={tone.accent}>Current</Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Not on a club yet.</p>
          )}

          <div className="eyebrow">CONTRACTS</div>
          {terms.length ? (
            <ul className="card-list">
              {terms.map((term) => (
                <li key={`${term.teamId}-${term.from}-${term.salary}`}>
                  <span>
                    <strong>
                      {money(term.salary)} / yr · {s.teams[term.teamId]?.short ?? 'Unknown'}
                    </strong>
                    <small>Season {seasonSpan(term.from, term.to)}</small>
                  </span>
                  {term.current && <Badge color={tone.accent}>Current</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No contract on record.</p>
          )}
        </section>

        <section>
          <div className="eyebrow">HONOURS</div>
          {awards.length ? (
            <ul className="card-list">
              {awards.map((honour) => (
                <li key={`${honour.season}-${honour.kind}-${honour.label}`}>
                  <span>
                    <strong>{honour.label}</strong>
                    <small>Season {honour.season}</small>
                  </span>
                  <Badge color={honour.kind === 'title' ? tone.accent : tone.muted}>
                    {honour.kind === 'title' ? 'Title' : 'Award'}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No titles or awards yet.</p>
          )}
        </section>

        <section>
          <div className="eyebrow">RECENT MOVES</div>
          {moves.length ? (
            <ul className="card-list">
              {moves.map((move) => (
                <li key={move.id}>
                  <span>
                    <strong>{describeMove(s, move)}</strong>
                    <small>
                      Season {move.season} · week {move.week}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No transfers or contract changes this window.</p>
          )}
        </section>
      </div>
    </div>
  )
}
