import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { activePhaseForWeek, phaseForWeek, type GameState } from './game'
import type { Region } from './seed'

export type View =
  | 'dashboard'
  | 'roster'
  | 'training'
  | 'scouting'
  | 'tactics'
  | 'matches'
  | 'competition'
  | 'finances'
  | 'settings'

/** Theme colors as CSS variables so inline styles follow the stylesheet palette. */
export const tone = {
  accent: 'var(--accent)',
  pos: 'var(--pos)',
  neg: 'var(--neg)',
  warn: 'var(--warn)',
  muted: 'var(--text-3)',
} as const

export const regionColors: Record<Region, string> = {
  Americas: '#6ea8fe',
  EMEA: '#f5a06a',
  Pacific: '#6fd6bd',
  China: '#e9c46a',
}

export const money = (value: number) => `$${Math.max(0, Math.round(value)).toLocaleString()}`
export const phaseName = (week: number) =>
  phaseForWeek(week) === 'Break' ? `Break before ${activePhaseForWeek(week)}` : phaseForWeek(week)

export const Badge = ({ children, color }: { children: ReactNode; color?: string }) => (
  <span
    className="badge"
    style={
      color
        ? {
            color,
            borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
            background: `color-mix(in srgb, ${color} 10%, transparent)`,
          }
        : undefined
    }
  >
    {children}
  </span>
)

export const Stat = ({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string
  value: string
  detail: string
  accent?: boolean
}) => (
  <div className={`stat ${accent ? 'accent' : ''}`}>
    <small>{label}</small>
    <strong>{value}</strong>
    <span>{detail}</span>
  </div>
)

export const PanelTitle = ({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string
  title: string
  right?: ReactNode
}) => (
  <div className="panel-title">
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
    </div>
    {right}
  </div>
)

export const Page = ({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) => (
  <div className="page">
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
    {children}
  </div>
)

export const TeamMark = ({
  s,
  id,
  size = 'md',
}: {
  s: GameState
  id: string
  size?: 'sm' | 'md' | 'lg'
}) => {
  const team = s.teams[id]
  return (
    <b className={`mark ${size}`} style={{ background: team.color }}>
      {team.short.slice(0, 3)}
    </b>
  )
}

export const Empty = ({ title, body }: { title: string; body: string }) => (
  <section className="panel empty">
    <span>◌</span>
    <h2>{title}</h2>
    <p>{body}</p>
  </section>
)

/** Centered pop-up for detail that should not push the page into scrolling. */
export function Modal({
  title,
  eyebrow,
  onClose,
  wide = false,
  children,
}: {
  title: string
  eyebrow?: string
  onClose: () => void
  wide?: boolean
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
