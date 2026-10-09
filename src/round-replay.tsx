import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  FastForward,
  Pause,
  Play,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { GameState } from './game'
import { buyLabel, clock, type MapReplay, type RoundReplay, type TeamBuy } from './round-sim'
import { TeamMark } from './ui'

const endText: Record<RoundReplay['endReason'], string> = {
  elimination: 'Team eliminated',
  detonation: 'Spike detonated',
  defuse: 'Spike defused',
}
const speeds = [1, 2, 4]
const EVENT_MS = 900
const ROUND_PAUSE_MS = 1600

function credits(buy: TeamBuy) {
  return `${(buy.credits / 1000).toFixed(1)}k`
}

/** Map score going into a round. */
function scoreBefore(rounds: RoundReplay[], index: number) {
  const previous = rounds[index - 1]
  return previous ? [previous.aScore, previous.bScore] : [0, 0]
}

/** What makes this round worth watching, from what's already been seen. */
export function roundStory(
  s: GameState,
  replay: MapReplay,
  index: number,
  over: boolean,
): string | null {
  const round = replay.rounds[index]
  const a = s.teams[replay.aId],
    b = s.teams[replay.bId]
  const [aBefore, bBefore] = scoreBefore(replay.rounds, index)
  if (over) {
    const winner = s.teams[round.winnerId]
    if (round.clutch)
      return `${s.players[round.clutch.playerId]?.name} clutches a 1v${round.clutch.versus} for ${winner.short}.`
    const kills: Record<string, number> = {}
    round.events.forEach((event) => {
      if (event.kind === 'kill') kills[event.killerId] = (kills[event.killerId] ?? 0) + 1
    })
    const [starId, starKills] = Object.entries(kills).sort(([, x], [, y]) => y - x)[0] ?? []
    if (starId && starKills >= 4)
      return `${s.players[starId]?.name} with ${starKills === 5 ? 'an ACE' : 'a 4K'}.`
    let streak = 0
    for (let at = index; at >= 0 && replay.rounds[at].winnerId === round.winnerId; at--) streak++
    // Biggest deficit the round winner has come back from on this map.
    const deficit = Math.max(
      0,
      ...replay.rounds
        .slice(0, index + 1)
        .map((played) =>
          round.winnerId === replay.aId
            ? played.bScore - played.aScore
            : played.aScore - played.bScore,
        ),
    )
    const [aNow, bNow] = [round.aScore, round.bScore]
    const level = round.winnerId === replay.aId ? aNow >= bNow : bNow >= aNow
    if (deficit >= 4 && level) return `Comeback on: ${winner.short} were down by ${deficit}.`
    if (streak >= 4) return `${winner.short} have won ${streak} rounds in a row.`
    const [winnerBuy, loserBuy] =
      round.winnerId === replay.aId ? round.buys : [round.buys[1], round.buys[0]]
    if (winnerBuy.buy === 'eco' && loserBuy.buy !== 'eco')
      return `${winner.short} win it on an eco. That breaks the economy.`
    return null
  }
  if (round.overtime) return 'Overtime. Both teams on full buys.'
  if (round.round === 1 || round.round === 13) return 'Pistol round.'
  const aPoint = aBefore === 12 && bBefore < 12,
    bPoint = bBefore === 12 && aBefore < 12
  if (aPoint || bPoint) return `Map point for ${(aPoint ? a : b).short}.`
  const [aBuy, bBuy] = round.buys
  if (aBuy.buy === 'eco' && bBuy.buy !== 'eco') return `${a.short} save on an eco.`
  if (bBuy.buy === 'eco' && aBuy.buy !== 'eco') return `${b.short} save on an eco.`
  return null
}

/**
 * Boxes in the round strip: 24 regulation rounds, plus overtime in pairs (25-26, 27-28, ...)
 * only once a tie at the end of the previous pair has been seen, so it never spoils the length.
 */
export function stripRounds(replay: MapReplay, revealed: number) {
  let length = 24
  while (length <= revealed) {
    const last = replay.rounds[length - 1]
    if (!last || last.aScore !== last.bScore) break
    length += 2
  }
  return length
}

/** Kills, deaths and alive state for everyone, up to a point in the map. */
function tallies(replay: MapReplay, index: number, shownEvents: number) {
  const kd: Record<string, { k: number; d: number }> = {}
  const dead = new Set<string>()
  replay.rounds.slice(0, index + 1).forEach((round, at) => {
    const events = at === index ? round.events.slice(0, shownEvents) : round.events
    events.forEach((event) => {
      if (event.kind !== 'kill') return
      kd[event.killerId] = { k: (kd[event.killerId]?.k ?? 0) + 1, d: kd[event.killerId]?.d ?? 0 }
      kd[event.victimId] = { k: kd[event.victimId]?.k ?? 0, d: (kd[event.victimId]?.d ?? 0) + 1 }
      if (at === index) dead.add(event.victimId)
    })
  })
  return { kd, dead }
}

/**
 * Plays back one map round by round: the score, both teams' buys, a round strip that shows
 * momentum swings, and the kill feed. The map was already simulated; this only reveals it.
 */
export function RoundReplayView({
  s,
  replay,
  onDone,
}: {
  s: GameState
  replay: MapReplay
  onDone: () => void
}) {
  const [index, setIndex] = useState(0)
  // Rounds already seen through to the end; the strip lets you jump among these (and the next).
  const [revealed, setRevealed] = useState(0)
  // Steps revealed in the current round: each event, then one more for the round result.
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const round = replay.rounds[index]
  const steps = round.events.length + 1
  const over = step >= steps
  const lastRound = index === replay.rounds.length - 1
  const finished = lastRound && over

  useEffect(() => {
    if (!playing) return
    if (finished) {
      setPlaying(false)
      return
    }
    const timer = window.setTimeout(
      () => {
        if (over) {
          setIndex((value) => value + 1)
          setStep(0)
        } else setStep((value) => value + 1)
      },
      (over ? ROUND_PAUSE_MS : EVENT_MS) / speed,
    )
    return () => window.clearTimeout(timer)
  }, [playing, over, finished, speed])

  useEffect(() => {
    if (over) setRevealed((value) => Math.max(value, index + 1))
  }, [over, index])
  const goTo = (next: number) => {
    setPlaying(false)
    setIndex(Math.max(0, Math.min(replay.rounds.length - 1, next)))
    setStep(Number.POSITIVE_INFINITY)
  }
  const skipToEnd = () => goTo(replay.rounds.length - 1)
  const togglePlay = () => {
    if (finished) return
    if (!playing && over) {
      setIndex((value) => value + 1)
      setStep(0)
    }
    setPlaying((value) => !value)
  }

  const a = s.teams[replay.aId],
    b = s.teams[replay.bId]
  const [aScore, bScore] = over ? [round.aScore, round.bScore] : scoreBefore(replay.rounds, index)
  const shownEvents = round.events.slice(0, Math.min(step, round.events.length))
  const { kd, dead } = tallies(replay, index, shownEvents.length)
  const story = roundStory(s, replay, index, over)
  const stripLength = stripRounds(replay, revealed)
  const aAttacking = round.attackerId === a.id
  const teamClass = (id: string) => (id === a.id ? 'side-a' : 'side-b')
  const sideOf = (playerId: string) => (a.lineup.includes(playerId) ? 'side-a' : 'side-b')
  const name = (id: string) => s.players[id]?.name ?? id

  return (
    <div className="replay">
      <div className="replay-head">
        {[a, b].map((team, teamIndex) => {
          const buy = round.buys[teamIndex]
          const attacking = teamIndex === 0 ? aAttacking : !aAttacking
          return (
            <div key={team.id} className={`replay-team ${teamClass(team.id)}`}>
              <TeamMark s={s} id={team.id} />
              <div>
                <strong>{team.short}</strong>
                <small>
                  {attacking ? 'Attack' : 'Defense'} · {buyLabel[buy.buy]} · {credits(buy)}
                </small>
              </div>
            </div>
          )
        })}
        <div className="replay-score">
          <b className={over && round.winnerId === a.id ? 'side-a' : ''}>{aScore}</b>
          <span>:</span>
          <b className={over && round.winnerId === b.id ? 'side-b' : ''}>{bScore}</b>
          <small>
            {replay.map} · Round {round.round}
            {round.overtime ? ' · OT' : ''}
          </small>
        </div>
      </div>

      <ol className="replay-strip" aria-label="Rounds">
        {Array.from({ length: stripLength }, (_, at) => {
          const played = replay.rounds[at]
          const shown = played && (at === index ? over : at < revealed)
          return (
            <li
              key={at}
              className={`${shown ? teamClass(played.winnerId) : ''} ${at === index ? 'current' : ''} ${at === 12 || at === 24 ? 'half' : ''}`}
              title={shown ? played.summary : `Round ${at + 1}`}
            >
              <button onClick={() => goTo(at)} disabled={!played || at > revealed}>
                {at + 1}
              </button>
            </li>
          )
        })}
      </ol>

      <p className="replay-story">{story ?? ' '}</p>

      <div className="replay-grid">
        <ol className="replay-feed">
          {shownEvents.map((event, at) => (
            <li key={`${event.kind}-${at}`}>
              <time>{clock(event.time)}</time>
              {event.kind === 'kill' ? (
                <>
                  <span className={sideOf(event.killerId)}>{name(event.killerId)}</span>
                  <em>
                    {event.weapon}
                    {event.headshot && <Crosshair size={12} aria-label="Headshot" />}
                  </em>
                  <span className={`victim ${sideOf(event.victimId)}`}>{name(event.victimId)}</span>
                  {event.first && <small>First blood</small>}
                </>
              ) : event.kind === 'plant' ? (
                <span className="replay-spike">
                  {name(event.playerId)} plants on {event.site}
                </span>
              ) : (
                <span className="replay-spike">{name(event.playerId)} defuses</span>
              )}
            </li>
          ))}
          {over && (
            <li className={`replay-end ${teamClass(round.winnerId)}`}>
              <time>{clock(round.endTime)}</time>
              <strong>
                {s.teams[round.winnerId].short} win the round · {endText[round.endReason]}
              </strong>
            </li>
          )}
          {!shownEvents.length && !over && <li className="muted">Buy phase…</li>}
        </ol>
        <div className="replay-rosters">
          {[a, b].map((team) => (
            <table key={team.id} className={teamClass(team.id)}>
              <thead>
                <tr>
                  <th>{team.short}</th>
                  <th>K</th>
                  <th>D</th>
                </tr>
              </thead>
              <tbody>
                {team.lineup.map((id) => (
                  <tr key={id} className={dead.has(id) ? 'dead' : ''}>
                    <td>{name(id)}</td>
                    <td>{kd[id]?.k ?? 0}</td>
                    <td>{kd[id]?.d ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </div>

      <div className="modal-actions replay-controls">
        <button
          className="secondary"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Previous round"
        >
          <ChevronLeft size={15} />
        </button>
        <button className="secondary" onClick={togglePlay} disabled={finished}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          className="secondary"
          onClick={() => goTo(over ? index + 1 : index)}
          disabled={finished}
          aria-label="Next round"
        >
          <ChevronRight size={15} />
        </button>
        <button
          className="secondary"
          onClick={() => setSpeed(speeds[(speeds.indexOf(speed) + 1) % speeds.length])}
        >
          {speed}x
        </button>
        <span className="replay-spacer" />
        {finished ? (
          <button className="primary" onClick={onDone}>
            {s.teams[round.winnerId].name} take {replay.map} <ArrowRight size={15} />
          </button>
        ) : (
          <button className="secondary" onClick={skipToEnd}>
            <FastForward size={15} /> Skip to map end
          </button>
        )}
      </div>
    </div>
  )
}
