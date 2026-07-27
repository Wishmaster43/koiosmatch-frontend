/**
 * SelectMenu — single-select dropdown: a button showing the current option that
 * opens a checklist. Closes on outside click.
 *
 * Reusable header-style picker (status, candidate type, owner, …). Options may
 * carry `initials` to render an Avatar (e.g. the owner/recruiter picker), so one
 * component covers plain and avatar pickers alike.
 */
import type { CSSProperties } from 'react'
import { useState, useRef, useEffect, useId } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import Avatar from './Avatar'

interface SelectOption {
  value: string
  label: ReactNode
  initials?: string
}

interface SelectMenuProps {
  // Handed down by the shared Field wrapper so the visible label names this
  // picker (a <button> is not labelable — see CreatableSelect for the full note).
  id?: string
  'aria-labelledby'?: string
  value?: string | null
  options?: Array<string | SelectOption>
  onChange: (value: string) => void
  placeholder?: string
  leading?: ReactNode
  menuWidth?: number
  // Optional trigger override (modal-sized fields honour style.fontSize too).
  style?: CSSProperties
}

export default function SelectMenu({ id, 'aria-labelledby': ariaLabelledBy, value, options = [], onChange, placeholder, leading, menuWidth = 170, style }: SelectMenuProps) {
  const listId = useId()
  const autoId = useId()
  const triggerId = id ?? autoId
  // See CreatableSelect: label + own text, so the value is not swallowed by the name.
  const labelledBy = ariaLabelledBy ? `${ariaLabelledBy} ${triggerId}` : undefined
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const opts: SelectOption[] = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  const current = opts.find(o => o.value === value)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Same disclosure semantics as CreatableSelect — one picker convention, so a
          screen reader describes both identically (§6). */}
      <button onClick={() => setOpen(o => !o)}
        id={triggerId} aria-labelledby={labelledBy}
        aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? listId : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', width: '100%',
          border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg)', cursor: 'pointer' , ...style }}>
        {leading}
        {current?.initials && <Avatar initials={current.initials} size={18} />}
        <span style={{ fontSize: (style as { fontSize?: number } | undefined)?.fontSize ?? 12, flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis', color: current ? 'var(--text)' : 'var(--text-muted)' }}>
          {current?.label ?? placeholder ?? '-'}
        </span>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>
      {open && (
        <div id={listId}
          style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4, minWidth: menuWidth,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
          {opts.length === 0 && <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{placeholder ?? '—'}</div>}
          {opts.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false) }}
              aria-current={value === o.value}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 12px', textAlign: 'left', fontSize: 12, cursor: 'pointer', border: 'none',
                background: value === o.value ? 'var(--color-primary-bg)' : 'none', color: 'var(--text)' }}>
              {o.initials && <Avatar initials={o.initials} size={20} />}
              <span style={{ flex: 1 }}>{o.label}</span>
              {value === o.value && <Check size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
