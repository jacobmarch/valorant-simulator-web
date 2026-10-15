import { DEBT_LIMIT } from './debt'
import { teamStrength, type GameState } from './game'
import { Badge, money, PanelTitle, Page, Stat, TeamMark, tone } from './ui'

/** Shown in place of the club's pages after the board fires the manager. */
export function FiredScreen({
  s,
  onTakeOver,
}: {
  s: GameState
  onTakeOver: (teamId: string) => void
}) {
  const fired = s.fired
  if (!fired) return null
  const lost = s.teams[fired.teamId]
  return (
    <Page
      eyebrow={`BOARD DECISION / SEASON ${fired.season}, WEEK ${fired.week}`}
      title="You've been fired"
      subtitle={`${lost.name}'s debt ran past the limit, so the board has let you go. Your save carries over: pick one of the clubs below that are replacing their coaches.`}
    >
      <div className="stats">
        <Stat
          label="Club balance at firing"
          value={money(fired.balance)}
          detail={lost.name}
          accent
        />
        <Stat
          label="Debt limit"
          value={money(-DEBT_LIMIT)}
          detail="the board fires you below this balance"
        />
      </div>
      <section className="panel">
        <PanelTitle
          eyebrow="OPEN POSITIONS"
          title="Clubs replacing their coaches"
          right={<Badge color={tone.warn}>{fired.options.length} offers</Badge>}
        />
        <div className="market-list">
          {fired.options.map((id) => {
            const team = s.teams[id]
            const rating = Math.round(teamStrength(s, id) * 10) / 10
            return (
              <div className="market-row" key={id}>
                <span>
                  <span className="firing-team">
                    <TeamMark s={s} id={id} size="sm" />
                    <strong>{team.name}</strong>
                  </span>
                  <small>
                    {team.region} · {team.wins}–{team.losses} · Team rating {rating} · Cash{' '}
                    {money(team.cash)}
                  </small>
                </span>
                <button className="primary compact" onClick={() => onTakeOver(id)}>
                  Take the job
                </button>
              </div>
            )
          })}
        </div>
      </section>
    </Page>
  )
}
