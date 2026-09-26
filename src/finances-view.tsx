import { currentTeam, saveGame, type GameState } from './game'
import {
  SPONSOR_SETTLE_WEEK,
  goalLabels,
  goalPhrase,
  goalMet,
  levelReason,
  payroll,
  pendingSponsorOffers,
  signSponsor,
  sponsorLevel,
  teamPrestige,
  tierLabels,
  type SponsorContract,
} from './sponsors'
import { Badge, PanelTitle, Page, Stat, money, tone } from './ui'

const tierColor = { easy: tone.pos, medium: tone.warn, high: tone.neg } as const
const signed = (value: number) => `${value < 0 ? '−' : '+'} ${money(Math.abs(value))}`

function contractStatus(s: GameState, teamId: string, contract: SponsorContract) {
  if (contract.settled)
    return contract.bonusPaid
      ? { text: 'Bonus paid', color: tone.pos }
      : { text: 'Bonus missed', color: tone.neg }
  if (contract.season > s.season)
    return { text: `Starts counting in ${contract.season}`, color: tone.muted }
  return goalMet(s, teamId, contract.goal, contract.season)
    ? { text: `Goal met · pays week ${SPONSOR_SETTLE_WEEK}`, color: tone.pos }
    : { text: 'Goal in progress', color: tone.warn }
}

export function Finances({ s, setState }: { s: GameState; setState: (s: GameState) => void }) {
  const t = currentTeam(s)
  const annualPayroll = payroll(s, t)
  const weeklySalaries = annualPayroll / 52
  const weeklySponsor = t.sponsor?.weekly ?? 0
  const net = weeklySponsor - weeklySalaries
  const market = pendingSponsorOffers(s)
  const level = sponsorLevel(t)
  const prestige = teamPrestige(t)
  const sign = (id: string) => {
    const next = signSponsor(s, id)
    saveGame(next)
    setState(next)
  }
  return (
    <Page
      eyebrow="OFFICE"
      title="Finances"
      subtitle="Sponsor income against payroll, week by week."
    >
      <div className="stats">
        <Stat label="Cash balance" value={money(t.cash)} detail="available for buyouts" accent />
        <Stat
          label="Weekly sponsor income"
          value={money(weeklySponsor)}
          detail={t.sponsor ? t.sponsor.sponsor : 'No sponsor signed'}
        />
        <Stat
          label="Weekly salaries"
          value={money(weeklySalaries)}
          detail={`${money(annualPayroll)} a year`}
        />
        <div className="stat">
          <small>Weekly net</small>
          <strong className={net >= 0 ? 'positive' : 'negative'}>{signed(net)}</strong>
          <span>before match winnings</span>
        </div>
      </div>
      {market && (
        <section className="panel">
          <PanelTitle
            eyebrow={`${level.toUpperCase()} LEVEL SPONSORS`}
            title={`Choose your ${market.season} sponsor`}
            right={
              <Badge color={tone.warn}>
                Decide by week {market.deadlineWeek}
                {market.deadlineSeason !== s.season ? ` ${market.deadlineSeason}` : ''}
              </Badge>
            }
          />
          <div className="sponsor-offers">
            {market.offers.map((offer) => {
              const offerNet = offer.weekly - weeklySalaries
              return (
                <article key={offer.id} className="sponsor-offer">
                  <header>
                    <Badge color={tierColor[offer.tier]}>{tierLabels[offer.tier]}</Badge>
                    <h3>{offer.sponsor}</h3>
                  </header>
                  <dl>
                    <dt>Weekly base</dt>
                    <dd>{money(offer.weekly)}</dd>
                    <dt>Season bonus</dt>
                    <dd className="positive">{money(offer.bonus)}</dd>
                    <dt>Net vs payroll</dt>
                    <dd className={offerNet >= 0 ? 'positive' : 'negative'}>
                      {signed(offerNet)} / wk
                    </dd>
                  </dl>
                  <p>
                    <strong>Bonus goal</strong>
                    {goalLabels[offer.goal]} in {offer.season}
                  </p>
                  <button className="primary" onClick={() => sign(offer.id)}>
                    Sign {offer.sponsor.split(' ')[0]}
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      )}
      <div className="columns">
        <section className="panel">
          <PanelTitle
            eyebrow="CURRENT DEAL"
            title={t.sponsor?.sponsor ?? 'No sponsor'}
            right={
              t.sponsor && (
                <Badge color={contractStatus(s, t.id, t.sponsor).color}>
                  {contractStatus(s, t.id, t.sponsor).text}
                </Badge>
              )
            }
          />
          {t.sponsor ? (
            <>
              <div className="sponsor-current">
                <span>
                  Tier
                  <strong>
                    {tierLabels[t.sponsor.tier]} · {t.sponsor.level}
                  </strong>
                </span>
                <span>
                  Weekly base<strong>{money(t.sponsor.weekly)}</strong>
                </span>
                <span>
                  Bonus<strong>{money(t.sponsor.bonus)}</strong>
                </span>
              </div>
              <p className="muted sponsor-reason">
                {t.sponsor.season} goal: {goalPhrase(t.sponsor.goal)}. Match wins add $25,000 and
                losses $5,000 on top.
              </p>
            </>
          ) : (
            <p className="muted">
              Sign one of the offers above. Until then only match winnings come in.
            </p>
          )}
        </section>
        <section className="panel">
          <PanelTitle
            eyebrow="SPONSOR STANDING"
            title={`${level} level`}
            right={<Badge>Prestige {prestige}</Badge>}
          />
          <div className="bar">
            <i style={{ width: `${prestige}%` }} />
          </div>
          <p className="muted sponsor-reason">
            {levelReason(t)}. Contender deals need 45 prestige; Champions deals need 70 or a recent
            international title.
          </p>
          <ul className="sponsor-history">
            {(t.history ?? [])
              .slice(-3)
              .reverse()
              .map((season) => (
                <li key={season.season}>
                  <span>{season.season}</span>
                  <strong>{season.best}</strong>
                </li>
              ))}
          </ul>
        </section>
      </div>
    </Page>
  )
}
