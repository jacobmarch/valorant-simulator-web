import { useState, type ReactNode } from 'react'
import {
  ArrowRight,
  Binoculars,
  Crosshair,
  Dumbbell,
  FastForward,
  LayoutDashboard,
  MonitorPlay,
  Play,
  Settings as SettingsIcon,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import {
  advanceWeek,
  createGame,
  currentTeam,
  dateForWeek,
  loadGame,
  resetGame,
  saveGame,
  simulateTournamentFixture,
  simulateTournamentRound,
  teamPlayers,
  type DelegationMode,
  type GameState,
  type Skill,
  type TransferRecord,
} from './game'
import {
  MAX_ROSTER,
  buyOutError,
  buyOutPlayer,
  contractValue,
  contractedPlayers,
  freeAgents,
  nextTransferWindow,
  playerOverall,
  releaseError,
  releasePlayer,
  rosterHistory,
  setPlayerStatus,
  signFreeAgent,
  signFreeAgentError,
  transferWindowForWeek,
  transferWindows,
  type TransferOutcome,
} from './transfers'
import { DashboardV2, MatchPreview, MatchesV2, TacticsV2 } from './game-views'
import { CompetitionV2 } from './competition-view'
import { DEFAULT_TRAINING } from './development'
import {
  SCOUTING_HOURS,
  TRAINING_HOURS,
  attentionItems,
  continueReport,
  nextAction,
  trainingGaps,
  type ContinueReport,
} from './flow'
import { seedTeams, skills, type Region } from './seed'
import {
  Badge,
  Modal,
  PanelTitle,
  Page,
  Stat,
  money,
  phaseName,
  regionColors,
  tone,
  type View,
} from './ui'

const navGroups: Array<{ label: string; items: Array<[View, string, ReactNode]> }> = [
  {
    label: 'Club',
    items: [['dashboard', 'Home', <LayoutDashboard size={17} key="i" />]],
  },
  {
    label: 'Squad',
    items: [
      ['roster', 'Roster & transfers', <Users size={17} key="i" />],
      ['training', 'Training', <Dumbbell size={17} key="i" />],
      ['scouting', 'Scouting', <Binoculars size={17} key="i" />],
    ],
  },
  {
    label: 'Matchday',
    items: [
      ['tactics', 'Match prep', <Crosshair size={17} key="i" />],
      ['matches', 'Match center', <MonitorPlay size={17} key="i" />],
      ['competition', 'Competition', <Trophy size={17} key="i" />],
    ],
  },
  {
    label: 'Office',
    items: [
      ['finances', 'Finances', <Wallet size={17} key="i" />],
      ['settings', 'Settings', <SettingsIcon size={17} key="i" />],
    ],
  },
]
function Start({ start }: { start: (name: string, team: string) => void }) {
  const [name, setName] = useState('Alex Mercer')
  const [region, setRegion] = useState<Region | 'All'>('All')
  const teams = seedTeams.filter((t) => region === 'All' || t.region === region)
  return (
    <main className="start">
      <div className="hero">
        <div className="brand">
          <b>V</b>
          <span>
            <strong>VCT Manager</strong>
            <small>2026 season</small>
          </span>
        </div>
        <h1>
          Build the next <em>world champion.</em>
        </h1>
        <p>
          Run a real VCT organization through the 2026 season. Shape the roster, set the plan, and
          turn weekly decisions into international trophies.
        </p>
        <div className="hero-meta">
          <span>48 organizations</span>
          <span>4 territories</span>
          <span>2 Masters events</span>
          <span>Champions</span>
        </div>
      </div>
      <section className="panel picker">
        <div className="picker-head">
          <div>
            <div className="eyebrow">New career</div>
            <h2>Choose your organization</h2>
          </div>
          <label>
            Manager name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
        <div className="tabs">
          {(['All', 'Americas', 'EMEA', 'Pacific', 'China'] as const).map((r) => (
            <button className={region === r ? 'active' : ''} onClick={() => setRegion(r)} key={r}>
              {r}
            </button>
          ))}
        </div>
        <div className="team-grid">
          {teams.map((t) => (
            <button className="team-card" onClick={() => start(name, t.id)} key={t.id}>
              <b style={{ background: t.color }}>{t.short.slice(0, 3)}</b>
              <span>
                <strong>{t.name}</strong>
                <small>
                  <i style={{ background: regionColors[t.region] }} />
                  {t.region}
                </small>
              </span>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
function Roster({ s, setState }: { s: GameState; setState: (s: GameState) => void }) {
  const t = currentTeam(s)
  const ps = teamPlayers(s)
  const [market, setMarket] = useState<'free' | 'contracted'>('free')
  const [marketRegion, setMarketRegion] = useState<Region>(t.region)
  const [notice, setNotice] = useState<string | null>(null)
  const [popup, setPopup] = useState<'history' | 'rules' | null>(null)
  const openWindow = transferWindowForWeek(s.week)
  const next = nextTransferWindow(s.week)
  const free = freeAgents(s).sort((a, b) => playerOverall(b) - playerOverall(a))
  const contracted = contractedPlayers(s, t.id)
    .filter((p) => s.teams[p.teamId as string].region === marketRegion)
    .sort((a, b) => playerOverall(b) - playerOverall(a))
    .slice(0, 20)
  const history = rosterHistory(s, t.id).slice(0, 8)
  const apply = (outcome: TransferOutcome) => {
    if (!outcome.ok) {
      setNotice(outcome.error)
      return
    }
    setNotice(null)
    saveGame(outcome.state)
    setState(outcome.state)
  }
  const describe = (m: TransferRecord) => {
    const from = m.fromTeamId ? s.teams[m.fromTeamId]?.short : 'Free agency'
    const to = m.toTeamId ? s.teams[m.toTeamId]?.short : 'Free agency'
    if (m.kind === 'status') return `${m.playerName}: ${m.note}`
    if (m.kind === 'release') return `${m.playerName} released by ${from}`
    if (m.kind === 'expiry') return `${m.playerName}'s contract with ${from} expired`
    if (m.kind === 'renewal') return `${m.playerName} re-signed with ${from} · ${m.note}`
    return `${m.playerName} · ${from} → ${to} · ${money(m.fee)}`
  }
  return (
    <Page
      eyebrow={`SQUAD / ${t.short}`}
      title="Roster & transfers"
      subtitle={`${ps.length} players on contract · ${t.lineup.length}/5 starters assigned · ${
        openWindow
          ? `${openWindow.label} open through week ${openWindow.end}`
          : `Transfer window closed · ${next.label} opens week ${next.start}`
      }`}
      actions={
        <button className="secondary" onClick={() => setPopup('history')}>
          Roster history
        </button>
      }
    >
      {notice && (
        <div className="callout" role="alert">
          <strong>Move not allowed</strong>
          <span>{notice}</span>
        </div>
      )}
      <div className="columns">
        <section className="panel">
          <PanelTitle
            eyebrow="CURRENT ROSTER"
            title="Depth chart"
            right={
              <span className="muted">
                {ps.length} / {MAX_ROSTER}
              </span>
            }
          />
          {ps.map((p) => {
            const releaseBlock = releaseError(s, t.id, p.id)
            return (
              <div className="player-row" key={p.id}>
                <b className="avatar" style={{ color: t.color, background: `${t.color}22` }}>
                  {p.name.slice(0, 2).toUpperCase()}
                </b>
                <div className="player-name">
                  <strong>{p.name}</strong>
                  <span>
                    <Badge color={p.status === 'starter' ? tone.accent : tone.muted}>
                      {p.status}
                    </Badge>
                    <Badge>{p.primaryRole}</Badge>
                    <Badge color={p.years <= 1 ? tone.warn : tone.muted}>
                      {`Age ${p.age} · ${p.years}y left`}
                    </Badge>
                    {p.isImport && <Badge>Import</Badge>}
                  </span>
                  <small>
                    POT {p.potential} · Morale {Math.round(p.morale)} · Form {p.form > 0 ? '+' : ''}
                    {p.form.toFixed(1)}
                  </small>
                </div>
                <b className="ovr">
                  {playerOverall(p)}
                  <small>OVR</small>
                </b>
                <select
                  value={p.status}
                  onChange={(e) =>
                    apply(
                      setPlayerStatus(
                        s,
                        t.id,
                        p.id,
                        e.target.value as 'starter' | 'substitute' | 'inactive',
                      ),
                    )
                  }
                >
                  <option value="starter">Starter</option>
                  <option value="substitute">Substitute</option>
                  <option value="inactive">Inactive</option>
                </select>
                <button
                  className="x"
                  title={releaseBlock ?? `Release ${p.name}`}
                  onClick={() => apply(releasePlayer(s, t.id, p.id))}
                >
                  ×
                </button>
              </div>
            )
          })}
        </section>
        <section className="panel">
          <PanelTitle
            eyebrow="MARKET"
            title="Available talent"
            right={
              <button className="link" onClick={() => setPopup('rules')}>
                Transfer rules
              </button>
            }
          />
          <div className="tabs">
            <button className={market === 'free' ? 'active' : ''} onClick={() => setMarket('free')}>
              Free agents
            </button>
            <button
              className={market === 'contracted' ? 'active' : ''}
              onClick={() => setMarket('contracted')}
            >
              Buyouts
            </button>
            {market === 'contracted' &&
              (['Americas', 'EMEA', 'Pacific', 'China'] as Region[]).map((r) => (
                <button
                  key={r}
                  className={marketRegion === r ? 'active' : ''}
                  onClick={() => setMarketRegion(r)}
                >
                  {r}
                </button>
              ))}
          </div>
          <div className="market-list">
            {(market === 'free' ? free : contracted).map((p) => {
              const block =
                market === 'free' ? signFreeAgentError(s, t.id, p.id) : buyOutError(s, t.id, p.id)
              return (
                <div className="market-row" key={p.id}>
                  <span>
                    <strong>
                      {p.name} · {playerOverall(p)} OVR
                    </strong>
                    <small>
                      {p.primaryRole} · Age {p.age}
                      {p.teamId ? ` · ${s.teams[p.teamId].short}` : ''} · {money(p.salary)} / yr ×{' '}
                      {p.years} · {market === 'free' ? 'cost' : 'buyout'} {money(contractValue(p))}
                    </small>
                  </span>
                  <button
                    className="secondary compact"
                    disabled={Boolean(block)}
                    title={block ?? undefined}
                    onClick={() =>
                      apply(
                        market === 'free'
                          ? signFreeAgent(s, t.id, p.id)
                          : buyOutPlayer(s, t.id, p.id),
                      )
                    }
                  >
                    {market === 'free' ? 'Sign' : 'Buy out'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </div>
      {popup === 'history' && (
        <Modal eyebrow="ROSTER HISTORY" title="Recent moves" onClose={() => setPopup(null)}>
          {history.length ? (
            history.map((m) => (
              <div className="market-row" key={m.id}>
                <span>
                  <strong>{describe(m)}</strong>
                  <small>
                    Season {m.season} · week {m.week}
                  </small>
                </span>
              </div>
            ))
          ) : (
            <p className="muted">No roster moves yet this save.</p>
          )}
        </Modal>
      )}
      {popup === 'rules' && (
        <Modal eyebrow="MARKET" title="Transfer rules" onClose={() => setPopup(null)}>
          <p className="modal-lead">
            Contracted players cost annual salary × remaining years. The buyer pays the seller
            immediately and takes over the contract.
          </p>
          <p className="muted">
            Signings, buyouts, and releases only happen in transfer windows: weeks{' '}
            {transferWindows
              .map((w) => (w.start === w.end ? `${w.start}` : `${w.start}–${w.end}`))
              .join(', ')}
            . You have {money(t.cash)} available.
          </p>
        </Modal>
      )}
    </Page>
  )
}
function Training({ s, setState }: { s: GameState; setState: (s: GameState) => void }) {
  const ps = teamPlayers(s)
  const setH = (id: string, skill: Skill, value: number) => {
    const n = structuredClone(s)
    const a = n.training[id] ?? {}
    const used = skills.filter((x) => x !== skill).reduce((sum, x) => sum + (a[x] ?? 0), 0)
    a[skill] = Math.max(0, Math.min(40 - used, value))
    n.training[id] = a
    saveGame(n)
    setState(n)
  }
  const gaps = trainingGaps(s)
  const applyBalanced = (ids: string[]) => {
    const n = structuredClone(s)
    ids.forEach((id) => {
      n.training[id] = { ...DEFAULT_TRAINING }
    })
    saveGame(n)
    setState(n)
  }
  return (
    <Page
      eyebrow={`SQUAD / WEEK ${s.week}`}
      title="Training"
      subtitle="Each player has 40 hours a week. Five hours maintains a skill; less than that and it can slip. Growth is faster for young players and slows near potential."
      actions={
        <button
          className="primary"
          disabled={!gaps.length}
          onClick={() => applyBalanced(gaps.map((p) => p.id))}
        >
          {gaps.length ? `Balanced plan for ${gaps.length} unset` : 'Everyone is planned'}
        </button>
      }
    >
      <section className="panel training">
        <PanelTitle
          eyebrow="INDIVIDUAL PLANS"
          title="Training allocations"
          right={
            <Badge color={gaps.length ? tone.warn : tone.accent}>
              {gaps.length ? `${gaps.length} with free hours` : 'All 40h assigned'}
            </Badge>
          }
        />
        <div className="training-grid">
          <div className="training-head">
            <span>Player</span>
            <span>Hours</span>
            {skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
            <span />
          </div>
          {ps.map((p) => {
            const a = s.training[p.id] ?? {}
            const total = skills.reduce((sum, x) => sum + (a[x] ?? 0), 0)
            return (
              <div className="training-line" key={p.id}>
                <div className="player-name">
                  <strong>{p.name}</strong>
                  <span>
                    {p.primaryRole} · {playerOverall(p)} OVR · POT {p.potential} · {p.age}y
                  </span>
                </div>
                <div className="hours">
                  <b className={total < TRAINING_HOURS ? 'short' : ''}>
                    {total}
                    <small>/{TRAINING_HOURS}</small>
                  </b>
                  <div className="bar">
                    <i style={{ width: `${(total / TRAINING_HOURS) * 100}%` }} />
                  </div>
                </div>
                {skills.map((skill) => (
                  <input
                    key={skill}
                    type="number"
                    min="0"
                    max="40"
                    aria-label={`${p.name} ${skill} hours`}
                    title={
                      (a[skill] ?? 0) >= 5
                        ? `${skill}: maintained`
                        : `${skill}: at risk of slipping`
                    }
                    className={(a[skill] ?? 0) >= 5 ? '' : 'risk'}
                    value={a[skill] ?? 0}
                    onChange={(e) => setH(p.id, skill, Number(e.target.value))}
                  />
                ))}
                <button className="link" onClick={() => applyBalanced([p.id])}>
                  Balanced
                </button>
              </div>
            )
          })}
        </div>
        <p className="muted training-key">Amber boxes are under 5 hours and can slip this week.</p>
      </section>
    </Page>
  )
}
function Scouting({ s, setState }: { s: GameState; setState: (s: GameState) => void }) {
  const t = currentTeam(s)
  const targets = Object.values(s.players)
    .filter((p) => p.teamId !== t.id)
    .slice(0, 36)
  const setH = (id: string, v: number) => {
    const n = structuredClone(s)
    const used = Object.entries(n.scoutingHours)
      .filter(([key]) => key !== id)
      .reduce((sum, [, x]) => sum + x, 0)
    n.scoutingHours[id] = Math.max(0, Math.min(40 - used, v))
    saveGame(n)
    setState(n)
  }
  const scoutUsed = Object.values(s.scoutingHours).reduce((sum, x) => sum + x, 0)
  return (
    <Page
      eyebrow={`SQUAD / WEEK ${s.week}`}
      title="Scouting"
      subtitle="Assign the weekly 40-hour pool; ratings show once a player is 60% scouted."
    >
      <section className="panel">
        <PanelTitle
          eyebrow="PLAYER DATABASE"
          title="Targets & intelligence"
          right={
            <Badge color={scoutUsed >= SCOUTING_HOURS ? tone.accent : tone.warn}>
              {SCOUTING_HOURS - scoutUsed}h unassigned
            </Badge>
          }
        />
        <div className="scout-list">
          {targets.map((p) => {
            const overall = Math.round(Object.values(p.ratings).reduce((a, b) => a + b, 0) / 6)
            return (
              <div className="scout-row" key={p.id}>
                <div className="player-name">
                  <strong>{p.name}</strong>
                  <span>
                    {p.teamId ? (s.teams[p.teamId]?.name ?? 'Tier 2') : 'Free agent'} ·{' '}
                    {p.primaryRole}
                  </span>
                </div>
                <div className="reveal">
                  <strong>{p.scoutProgress >= 60 ? `${overall} OVR` : 'Unknown rating'}</strong>
                  <div className="bar">
                    <i style={{ width: `${p.scoutProgress}%` }} />
                  </div>
                  <small>{Math.round(p.scoutProgress)}% scouted</small>
                </div>
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={s.scoutingHours[p.id] ?? 0}
                  onChange={(e) => setH(p.id, Number(e.target.value))}
                />
              </div>
            )
          })}
        </div>
      </section>
    </Page>
  )
}
function Finances({ s }: { s: GameState }) {
  const t = currentTeam(s)
  const payroll = t.playerIds.reduce((sum, id) => sum + s.players[id].salary, 0)
  return (
    <Page
      eyebrow="OFFICE"
      title="Finances"
      subtitle="Cash, payroll, and what moves the number each week."
    >
      <div className="stats">
        <Stat label="Cash balance" value={money(t.cash)} detail="available for buyouts" accent />
        <Stat label="Annual payroll" value={money(payroll)} detail="current roster commitments" />
        <Stat label="Weekly burn" value={money(payroll / 52)} detail="salary deduction" />
        <Stat
          label="Salary headroom"
          value={money(t.salaryBudget - payroll)}
          detail="against budget"
        />
      </div>
      <section className="panel ledger">
        <PanelTitle eyebrow="CASHFLOW GUIDE" title="What moves the number?" />
        <div className="ledger-grid">
          <span>
            Salary<strong className="negative">− {money(payroll / 52)} / week</strong>
          </span>
          <span>
            Match win<strong className="positive">+ $25,000</strong>
          </span>
          <span>
            Appearance<strong className="positive">+ $5,000</strong>
          </span>
          <span>
            Prize money<strong className="positive">Event configured</strong>
          </span>
        </div>
        <div className="callout">
          <strong>Transparent contract math</strong>
          <span>Buyouts equal annual salary × remaining years.</span>
        </div>
      </section>
    </Page>
  )
}
function Settings({
  s,
  setState,
  onNew,
  onReset,
}: {
  s: GameState
  setState: (s: GameState) => void
  onNew: () => void
  onReset: () => void
}) {
  const change = (key: string, value: DelegationMode | boolean) => {
    const n = structuredClone(s)
    n.settings[key] = value
    saveGame(n)
    setState(n)
  }
  return (
    <Page
      eyebrow="OFFICE"
      title="Settings"
      subtitle="Management preferences and your browser save."
    >
      <section className="panel settings">
        <PanelTitle eyebrow="DELEGATION" title="Management modes" />
        {[
          ['roster', 'Roster & contracts'],
          ['training', 'Player training'],
          ['scouting', 'Scouting'],
          ['finances', 'Finances'],
        ].map(([key, label]) => (
          <div className="setting" key={key}>
            <span>
              <strong>{label}</strong>
              <small>Choose how much of this area you own.</small>
            </span>
            <select
              value={String(s.settings[key])}
              onChange={(e) => change(key, e.target.value as DelegationMode)}
            >
              <option value="hands-on">Hands-on</option>
              <option value="balanced">Balanced</option>
              <option value="hands-off">Hands-off</option>
            </select>
          </div>
        ))}
        <div className="setting">
          <span>
            <strong>Optional immersion systems</strong>
            <small>Keep personality and sponsorship placeholders disabled.</small>
          </span>
          <button
            className={`toggle ${s.settings.sponsorships ? 'on' : ''}`}
            onClick={() => change('sponsorships', !s.settings.sponsorships)}
          >
            <i />
          </button>
        </div>
      </section>
      <section className="panel save">
        <div>
          <div className="eyebrow">SAVE MANAGEMENT</div>
          <h2>One automatic browser save</h2>
          <p>Last saved {new Date(s.saveTimestamp).toLocaleString()}</p>
        </div>
        <div>
          <button className="secondary" onClick={onNew}>
            New Game
          </button>
          <button className="danger" onClick={onReset}>
            Reset Save
          </button>
        </div>
      </section>
    </Page>
  )
}
function ResultBanner({
  s,
  report,
  onOpen,
  onCompetition,
  onClose,
}: {
  s: GameState
  report: ContinueReport
  onOpen: (id: string) => void
  onCompetition: () => void
  onClose: () => void
}) {
  const match = report.managed[0]
  const won = match?.winnerId === s.currentTeamId
  return (
    <div className={`result-banner ${match ? (won ? 'win' : 'loss') : ''}`} role="status">
      {match ? (
        <>
          <span className="result-banner-tag">{won ? 'Win' : 'Loss'}</span>
          <strong>
            {s.teams[match.aId].short} {match.aScore}–{match.bScore} {s.teams[match.bId].short}
          </strong>
          <span className="muted">
            {match.phase} · Bo{match.bestOf}
            {report.others ? ` · ${report.others} other series played` : ''}
          </span>
          <button className="link" onClick={() => onOpen(match.id)}>
            Open match <ArrowRight size={14} />
          </button>
        </>
      ) : (
        <>
          <span className="result-banner-tag">Week {report.week}</span>
          <strong>
            {report.others
              ? `${report.others} series played around the league`
              : 'The calendar moved on'}
          </strong>
          <span className="muted">
            {phaseName(report.week)} · {dateForWeek(report.week)}
          </span>
          {report.others > 0 && (
            <button className="link" onClick={onCompetition}>
              See results <ArrowRight size={14} />
            </button>
          )}
        </>
      )}
      <button className="icon-button" onClick={onClose} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  )
}
export default function App() {
  const [s, setS] = useState<GameState | null>(() => loadGame())
  const [view, setView] = useState<View>('dashboard')
  const [matchId, setMatchId] = useState<string>()
  const [report, setReport] = useState<ContinueReport | null>(null)
  const [previewId, setPreviewId] = useState<string>()
  const [attack, setAttack] = useState('Measured defaults')
  const [defense, setDefense] = useState('Disciplined retakes')
  const start = (name: string, team: string) => {
    const n = createGame(name, team)
    saveGame(n)
    setS(n)
    setView('dashboard')
  }
  const newGame = () => {
    if (confirm('Start a new career? Your current local save will be replaced.')) {
      resetGame()
      setS(null)
    }
  }
  const reset = () => {
    if (confirm('Reset the local save? This cannot be undone.')) {
      resetGame()
      setS(null)
    }
  }
  if (!s) return <Start start={start} />
  const t = currentTeam(s)
  const step = nextAction(s)
  const todo = attentionItems(s).filter((item) => item.level !== 'info')
  const commit = (next: GameState) => {
    setReport(continueReport(s, next))
    setS(next)
  }
  const proceed = () =>
    commit(
      step.mode === 'round'
        ? simulateTournamentRound(s, attack, defense)
        : advanceWeek(s, attack, defense),
    )
  const simWeek = () => commit(advanceWeek(s, attack, defense))
  const simMatch = (fixtureId: string) =>
    commit(simulateTournamentFixture(s, fixtureId, attack, defense))
  const openMatch = (id: string) => {
    setMatchId(id)
    setView('matches')
    setReport(null)
    setPreviewId(undefined)
  }
  const go = (next: View) => {
    setView(next)
    setReport(null)
    window.scrollTo?.({ top: 0 })
  }
  const content =
    view === 'dashboard' ? (
      <DashboardV2
        s={s}
        setState={setS}
        setView={go}
        setMatchId={setMatchId}
        onPreview={setPreviewId}
      />
    ) : view === 'roster' ? (
      <Roster s={s} setState={setS} />
    ) : view === 'training' ? (
      <Training s={s} setState={setS} />
    ) : view === 'scouting' ? (
      <Scouting s={s} setState={setS} />
    ) : view === 'tactics' ? (
      <TacticsV2
        s={s}
        setState={setS}
        attack={attack}
        setAttack={setAttack}
        defense={defense}
        setDefense={setDefense}
      />
    ) : view === 'matches' ? (
      <MatchesV2 s={s} initialMatchId={matchId} key={matchId} />
    ) : view === 'competition' ? (
      <CompetitionV2
        s={s}
        onSimMatch={simMatch}
        onSimulateRound={() => commit(simulateTournamentRound(s, attack, defense))}
        onOpenMatch={setPreviewId}
      />
    ) : view === 'finances' ? (
      <Finances s={s} />
    ) : (
      <Settings s={s} setState={setS} onNew={newGame} onReset={reset} />
    )
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <b>V</b>
          <span>
            <strong>VCT Manager</strong>
            <small>Season {s.season}</small>
          </span>
        </div>
        <div className="club-card">
          <b className="mark md" style={{ background: t.color }}>
            {t.short.slice(0, 3)}
          </b>
          <span>
            <strong>{t.name}</strong>
            <small>
              {t.region} · {t.wins}–{t.losses}
            </small>
          </span>
        </div>
        <nav className="side-nav">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <small>{group.label}</small>
              {group.items.map(([v, label, icon]) => {
                const count = todo.filter((item) => item.view === v).length
                return (
                  <button
                    className={view === v ? 'active' : ''}
                    onClick={() => go(v)}
                    key={v}
                    aria-current={view === v ? 'page' : undefined}
                  >
                    {icon}
                    <span>{label}</span>
                    {count > 0 && <i className="nav-dot" title={`${count} to review`} />}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="manager">
          <b className="avatar">{s.managerName.slice(0, 2).toUpperCase()}</b>
          <span>
            <strong>{s.managerName}</strong>
            <small>Manager · {t.short}</small>
          </span>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="calendar-chip">
            <strong>Week {s.week}</strong>
            <span>{dateForWeek(s.week)}</span>
            <em>{phaseName(s.week)}</em>
          </div>
          <span className="cash" title="Cash balance">
            {money(t.cash)}
          </span>
          <div className="continue">
            {step.mode === 'round' && (
              <button
                className="secondary"
                onClick={simWeek}
                title="Play every remaining series this week"
              >
                <FastForward size={15} /> Sim week
              </button>
            )}
            <button className="advance" onClick={proceed}>
              <span>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </span>
              <Play size={16} fill="currentColor" />
            </button>
          </div>
        </header>
        {report && (
          <ResultBanner
            s={s}
            report={report}
            onOpen={setPreviewId}
            onCompetition={() => {
              go('competition')
              setReport(null)
            }}
            onClose={() => setReport(null)}
          />
        )}
        {content}
      </main>
      {previewId && (
        <MatchPreview
          s={s}
          matchId={previewId}
          onClose={() => setPreviewId(undefined)}
          onOpenFull={openMatch}
        />
      )}
    </div>
  )
}
