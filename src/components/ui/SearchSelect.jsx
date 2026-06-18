/**
 * SearchSelect — ghost "+ add" button that opens a searchable checklist dropdown.
 *
 * Replaces the duplicated open-dropdown-with-search-and-checkmarks blocks in the
 * drawer (link branch, add driving licence). Multi-select by default: clicking an
 * option toggles it in `selected` via `onToggle`. Closes on outside click.
 *
 * options: Array<string | { value, label }>
 */
import { useState, useRef, useEffect } from 'react'
import { Plus, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function SearchSelect({
  triggerLabel, options = [], selected = [], onToggle, searchable = true, width = 240,
}) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  const shown = query ? opts.filter(o => o.label.toLowerCase().includes(query.toLowerCase())) : opts

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 11, fontWeight: 500,
          border: '1px dashed var(--border)', borderRadius: 7, background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
        <Plus size={11} /> {triggerLabel}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4, width,
          background: 'white', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          {searchable && (
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search')} autoFocus
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none' }} />
            </div>
          )}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {shown.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('noResults')}</div>
            )}
            {shown.map(o => {
              const isSel = selected.includes(o.value)
              return (
                <button key={o.value} onClick={() => onToggle(o.value)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                    padding: '9px 12px', fontSize: 12, textAlign: 'left', cursor: 'pointer', border: 'none',
                    background: isSel ? 'var(--color-primary-bg)' : 'none', color: 'var(--text)' }}>
                  {o.label}
                  {isSel && <Check size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
