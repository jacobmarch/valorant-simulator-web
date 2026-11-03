import {
  Children,
  type CSSProperties,
  isValidElement,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

export type DropdownOption = { value: string; label: ReactNode }

const textOf = (node: ReactNode): string =>
  Children.toArray(node)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
    .join('')
    .trim()
    .replace(/\s+/g, ' ')

// Reads <option> children, so call sites keep the markup they had with a native select.
// An option without a value attribute uses its text, as the native element does.
export const readOptions = (children: ReactNode): DropdownOption[] =>
  Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode }>(child)) return []
    const { value, children: label } = child.props
    return [{ value: value != null ? String(value) : textOf(label), label }]
  })

const MENU_GAP = 4
const MENU_MAX_HEIGHT = 320

type DropdownProps = {
  value: string | number
  onChange: (value: string) => void
  children: ReactNode
  className?: string
  title?: string
  style?: CSSProperties
  'aria-label'?: string
}

// Themed replacement for <select>. The list is portaled to the body so no parent
// overflow or stacking context can clip it. Like a native select, onChange only
// fires when the picked value differs from the current one.
export function Dropdown({
  value,
  onChange,
  children,
  className,
  title,
  style,
  'aria-label': ariaLabel,
}: DropdownProps) {
  const options = readOptions(children)
  const current = String(value)
  const selected = options.findIndex((option) => option.value === current)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const id = useId()
  const listId = `${id}-list`

  const openList = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const below = window.innerHeight - rect.bottom
      const flipUp = below < MENU_MAX_HEIGHT && rect.top > below
      setMenuStyle({
        left: rect.left,
        minWidth: rect.width,
        ...(flipUp
          ? { bottom: window.innerHeight - rect.top + MENU_GAP }
          : { top: rect.bottom + MENU_GAP }),
      })
    }
    setActive(selected >= 0 ? selected : 0)
    setOpen(true)
  }

  const choose = (index: number) => {
    const next = options[index]
    if (next && next.value !== current) onChange(next.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    const onScroll = (event: Event) => {
      if (listRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onResize = () => setOpen(false)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openList()
      }
      return
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive((index) => Math.min(options.length - 1, index + 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive((index) => Math.max(0, index - 1))
        break
      case 'Home':
        event.preventDefault()
        setActive(0)
        break
      case 'End':
        event.preventDefault()
        setActive(options.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        choose(active)
        break
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div
      ref={rootRef}
      className={['dropdown', open && 'open', className].filter(Boolean).join(' ')}
      style={style}
    >
      <button
        ref={triggerRef}
        type="button"
        className="dropdown-trigger"
        aria-label={ariaLabel}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        {/* Every label is laid out in one grid cell, so the trigger is as wide as the longest option. */}
        <span className="dropdown-value">
          {options.map((option, index) => (
            <span
              key={option.value}
              data-option={option.value}
              className={index === selected ? undefined : 'dropdown-sizer'}
              aria-hidden={index === selected ? undefined : true}
            >
              {option.label}
            </span>
          ))}
          {selected < 0 && <span>{current}</span>}
        </span>
        <span className="dropdown-chevron" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <ul ref={listRef} id={listId} role="listbox" className="dropdown-menu" style={menuStyle}>
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={index === selected}
                data-index={index}
                className={[
                  'dropdown-option',
                  index === active && 'active',
                  index === selected && 'selected',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                {option.label}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
