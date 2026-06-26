/**
 * CreatableSelect — a single-select dropdown with a search box that can also
 * create a new value (combobox). Pick from the managed list, or type a value and
 * add it via the "+" row / Enter. Set `allowCreate={false}` for a strict dropdown.
 *
 * One stored value (a string) regardless of mode — no second field. Closes on
 * outside click. Styling matches SelectMenu so pickers look consistent.
 */
import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { ChevronDown, Check, Plus } from 'lucide-react'

interface CreatableOption {
  value: string
  label: string
}

interface CreatableSelectProps {
  value?: string | null
  options?: Array<string | CreatableOption>
  onChange: (value: string) => void
  placeholder?: string
  allowCreate?: boolean
  menuWidth?: number
  style?: CSSProperties
}

export default function CreatableSelect({
  value, options = [], onChange, placeholder, allowCreate = true, menuWidth = 220, style,
}: CreatableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click; focus the search box when opening.
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const opts: CreatableOption[] = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  const current = opts.find(o => o.value === value)
  const q = query.trim()
  const ql = q.toLowerCase()
  const filtered = ql ? opts.filter(o => o.label.toLowerCase().includes(ql)) : opts
  const exists = opts.some(o => o.label.toLowerCase() === ql)
  const canCreate = allowCreate && q.length > 0 && !exists

  const pick = (v: string) => { onChange(v); setOpen(false); setQuery('') }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', width: '100%',
          boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6,
          background: 'white', cursor: 'pointer', ...style }}>
        <span style={{ fontSize: 12, flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis', color: (current || value) ? 'var(--text)' : 'var(--text-muted)' }}>
          {current?.label ?? value ?? placeholder ?? '-'}
        </span>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4, minWidth: menuWidth,
          background: 'white', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {/* Search / type-to-create */}
          <div style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canCreate) pick(q); if (e.key === 'Escape') setOpen(false) }}
              placeholder={placeholder}
              style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 12,
                border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.map(o => (
              <button key={o.value} type="button" onClick={() => pick(o.value)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                  textAlign: 'left', fontSize: 12, cursor: 'pointer', border: 'none',
                  background: value === o.value ? 'var(--color-primary-bg)' : 'none', color: 'var(--text)' }}>
                <span style={{ flex: 1 }}>{o.label}</span>
                {value === o.value && <Check size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
              </button>
            ))}
            {canCreate && (
              <button type="button" onClick={() => pick(q)} title={q}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px',
                  textAlign: 'left', fontSize: 12, cursor: 'pointer', border: 'none',
                  borderTop: filtered.length ? '1px solid var(--border)' : 'none',
                  background: 'none', color: 'var(--color-primary)', fontWeight: 600 }}>
                <Plus size={13} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{q}”</span>
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>—</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
