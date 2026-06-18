/**
 * SelectMenu — single-select dropdown: a button showing the current option that
 * opens a checklist. Closes on outside click.
 *
 * Reusable header-style picker (status, candidate type, owner, …). Options may
 * carry `initials` to render an Avatar (e.g. the owner/recruiter picker), so one
 * component covers plain and avatar pickers alike.
 *
 * options: Array<string | { value, label, initials? }>
 */
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import Avatar from './Avatar'

export default function SelectMenu({ value, options = [], onChange, placeholder, leading, menuWidth = 170 }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  const current = opts.find(o => o.value === value)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', width: '100%',
          border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg)', cursor: 'pointer' }}>
        {leading}
        {current?.initials && <Avatar initials={current.initials} size={18} />}
        <span style={{ fontSize: 12, flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis', color: current ? 'var(--text)' : 'var(--text-muted)' }}>
          {current?.label ?? placeholder ?? '-'}
        </span>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4, minWidth: menuWidth,
          background: 'white', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
          {opts.length === 0 && <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{placeholder ?? '—'}</div>}
          {opts.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false) }}
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
