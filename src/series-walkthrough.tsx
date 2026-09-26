import { useState } from 'react'
import { ArrowRight, FastForward, Layers } from 'lucide-react'
import {
  hasMatchDetail,
  type Fixture,
  type GameState,
  type MapResult,
  type MatchResult,
} from './game'
import { Modal, TeamMark } from './ui'

/** Asks how to play a single series: all at once, or one map at a time. */
export function SimChoice({
  s,
  fixture,
  onQuick,
  onMapByMap,
  onClose,
}: {
  s: GameState
  fixture: Fixture
  onQuick: () => void
  onMapByMap: () => void
  onClose: () => void
}) {
  const a = s.teams[fixture.aId],
    b = fixture.bId ? s.teams[fixture.bId] : undefined
  return (
    <Modal
      eyebrow={`${fixture.phase} · ${fixture.label} · Bo${fixture.bestOf}`}
      title={`${a.name} vs ${b?.name ?? 'Bye'}`}
      onClose={onClose}
    >
      <div className="sim-choice">
        <button onClick={onQuick}>
          <FastForward size={18} />
          <strong>Quick sim</strong>
          <span>Play the whole series and see the final score.</span>
        </button>
        <button onClick={onMapByMap}>
          <Layers size={18} />
          <strong>Map by map</strong>
          <span>Watch the veto, then play each map and follow the series as it unfolds.</span>
        </button>
      </div>
    </Modal>
  )
}

/** Rounds each team took in the first half (rounds 1-12) of a map. */
function halfScore(s: GameState, match: MatchResult, map: MapResult) {
  const first = map.rounds.slice(0, 12),
    a = s.teams[match.aId].short
  const aWon = first.filter((round) => round.startsWith(`${a} won`)).length
  return [aWon, first.length - aWon]
}

function mapStar(s: GameState, map: MapResult) {
  const [id, stat] =
    Object.entries(map.stats).sort(([, left], [, right]) => right.acs - left.acs)[0] ?? []
  return id && stat ? { name: s.players[id]?.name ?? id, stat } : null
}

function keyRounds(map: MapResult) {
  const notable = map.rounds.filter(
    (round) =>
      round.includes('ACE') ||
      round.includes('4K') ||
      round.includes('3K') ||
      round.startsWith('OT'),
  )
  const last = map.rounds[map.rounds.length - 1]
  return [...notable.slice(-4), ...(last && !notable.includes(last) ? [last] : [])]
}

/**
 * Reveals an already-played series one map at a time. The series is simulated up front, so
 * closing the pop-up early just skips to the final result.
 */
export function SeriesWalkthrough({
  s,
  match,
  onFinish,
  onOpenFull,
}: {
  s: GameState
  match: MatchResult
  onFinish: () => void
  onOpenFull: (id: string) => void
}) {
  const [shown, setShown] = useState(0)
  const a = s.teams[match.aId],
    b = s.teams[match.bId]
  const played = match.maps.slice(0, shown)
  const aMaps = played.filter((map) => map.winnerId === a.id).length,
    bMaps = played.length - aMaps
  const done = shown >= match.maps.length
  const current = played[played.length - 1]
  const upcoming = match.maps[shown]?.map ?? match.veto[shown]
  const star = current ? mapStar(s, current) : null
  const half = current ? halfScore(s, match, current) : null
  const detail = hasMatchDetail(match)
  return (
    <Modal
      eyebrow={`${match.phase} · Week ${match.week} · Bo${match.bestOf} · Map by map`}
      title={`${a.name} vs ${b.name}`}
      onClose={onFinish}
      wide
    >
      <div className="preview-score walkthrough-score">
        <span className={done && match.winnerId === a.id ? 'winner' : ''}>
          <TeamMark s={s} id={a.id} />
          {a.short}
        </span>
        <b>
          {aMaps} – {bMaps}
        </b>
        <span className={done && match.winnerId === b.id ? 'winner' : ''}>
          {b.short}
          <TeamMark s={s} id={b.id} />
        </span>
      </div>
      <ol className="walkthrough-maps">
        {match.veto.slice(0, Math.max(match.maps.length, match.bestOf)).map((mapName, index) => {
          const result = index < shown ? match.maps[index] : undefined
          const unplayed = index >= match.maps.length
          return (
            <li
              key={`${mapName}-${index}`}
              className={`${result ? 'played' : unplayed && done ? 'unplayed' : ''} ${index === shown && !done ? 'next' : ''}`}
            >
              <small>Map {index + 1}</small>
              <strong>{mapName}</strong>
              {result ? (
                <em>
                  {result.aScore}–{result.bScore} · {s.teams[result.winnerId]?.short}
                </em>
              ) : (
                <em>{unplayed && done ? 'Not needed' : index === shown ? 'Up next' : '—'}</em>
              )}
            </li>
          )
        })}
      </ol>
      {!current ? (
        <>
          <h3 className="modal-subhead">Map veto</h3>
          {match.vetoLog?.length ? (
            <ul className="walkthrough-veto">
              {match.vetoLog.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Maps: {match.veto.join(', ')}.</p>
          )}
        </>
      ) : (
        <div className="walkthrough-map">
          <h3 className="modal-subhead">
            {current.map}: {s.teams[current.winnerId]?.name} win {current.aScore}–{current.bScore}
          </h3>
          <p className="muted">
            {half && `First half ${a.short} ${half[0]}–${half[1]} ${b.short}. `}
            {current.rounds.length > 24 && 'Went to overtime. '}
            {star &&
              `${star.name} top-fragged with ${star.stat.acs} ACS (${star.stat.kills}/${star.stat.deaths}/${star.stat.assists}).`}
          </p>
          {detail && keyRounds(current).length > 0 && (
            <ul className="preview-notes">
              {keyRounds(current).map((round, index) => (
                <li key={`${round}-${index}`}>{round}</li>
              ))}
            </ul>
          )}
          {done && (
            <p className="walkthrough-final">
              {s.teams[match.winnerId].name} win the series {Math.max(match.aScore, match.bScore)}–
              {Math.min(match.aScore, match.bScore)}.
            </p>
          )}
        </div>
      )}
      <div className="modal-actions">
        {done ? (
          <>
            <button className="secondary" onClick={() => onOpenFull(match.id)}>
              Full box score
            </button>
            <button className="primary" onClick={onFinish}>
              Continue <ArrowRight size={15} />
            </button>
          </>
        ) : (
          <>
            <button className="secondary" onClick={onFinish}>
              Skip to result
            </button>
            <button className="primary" onClick={() => setShown((value) => value + 1)}>
              Play map {shown + 1}: {upcoming} <ArrowRight size={15} />
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
