import { ChevronDown, ChevronUp } from 'lucide-react'
import { saveGame, type Fixture, type GameState, type Team } from './game'
import {
  managerMapOrder,
  mapOrder,
  mapTiers,
  moveMap,
  runVeto,
  seasonMapRecords,
  suggestedMapTiers,
} from './maps'
import './map-plan.css'

/**
 * The manager's map pool: their 1-7 order with this season's record on each map,
 * and the veto that order produces against the next opponent.
 */
export function MapPlan({
  s,
  setState,
  team,
  opponent,
  fixture,
}: {
  s: GameState
  setState: (state: GameState) => void
  team: Team
  opponent?: Team
  fixture?: Fixture
}) {
  const order = mapOrder(s, team.id),
    custom = Boolean(managerMapOrder(s, team.id)),
    tiers = mapTiers(s, team.id),
    suggested = suggestedMapTiers(s, team.id),
    records = seasonMapRecords(s, team.id),
    opponentTiers = opponent ? mapTiers(s, opponent.id) : undefined,
    opponentRecords = opponent ? seasonMapRecords(s, opponent.id) : undefined
  const veto =
    opponent && fixture ? runVeto(s, fixture.aId, fixture.bId ?? opponent.id, fixture.bestOf) : null
  const saveOrder = (next: string[] | undefined) => {
    const state = structuredClone(s)
    state.teams[team.id].mapOrder = next
    saveGame(state)
    setState(state)
  }
  return (
    <div className="maps map-plan">
      <div className="map-plan-head">
        <div className="eyebrow">MAP POOL / 1 = BEST / SEASON RECORDS</div>
        {custom ? (
          <button type="button" className="map-plan-reset" onClick={() => saveOrder(undefined)}>
            Use suggested
          </button>
        ) : (
          <small>Suggested from your lineup</small>
        )}
      </div>
      <div className="map-plan-legend">
        <span>Tier</span>
        <span>Map</span>
        <span>{team.short}</span>
        <span>{opponent?.short ?? ''}</span>
        <span />
      </div>
      {order.map((map, index) => {
        const record = records[map]
        return (
          <div className="map map-plan-row" key={map}>
            <b>{tiers[map]}</b>
            <span className="map-plan-name">
              {map}
              {custom && suggested[map] !== tiers[map] && (
                <small title="Tier suggested from your lineup">sugg. {suggested[map]}</small>
              )}
            </span>
            <span className="map-plan-record">
              {record.wins}–{record.losses}
            </span>
            <span className="map-plan-opp">
              {opponentTiers && opponentRecords && (
                <>
                  <b>T{opponentTiers[map]}</b>
                  {opponentRecords[map].wins}–{opponentRecords[map].losses}
                </>
              )}
            </span>
            <span className="map-plan-move">
              <button
                type="button"
                aria-label={`Move ${map} up`}
                disabled={index === 0}
                onClick={() => saveOrder(moveMap(order, map, -1))}
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                aria-label={`Move ${map} down`}
                disabled={index === order.length - 1}
                onClick={() => saveOrder(moveMap(order, map, 1))}
              >
                <ChevronDown size={14} />
              </button>
            </span>
          </div>
        )
      })}
      {veto && opponent && (
        <>
          <div className="eyebrow map-plan-veto-title">
            PROJECTED VETO / BO{fixture?.bestOf} VS {opponent.short}
          </div>
          <p className="map-plan-note">
            You ban from the bottom of your order and pick the highest map still open.
          </p>
          {veto.steps.map((step, index) => (
            <div className={step.action === 'ban' ? 'map' : 'map selected'} key={step.map}>
              <b>{index + 1}</b>
              {step.map}
              <small>
                {step.action === 'decider'
                  ? 'decider'
                  : `${s.teams[step.teamId].short} ${step.action}`}
              </small>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
