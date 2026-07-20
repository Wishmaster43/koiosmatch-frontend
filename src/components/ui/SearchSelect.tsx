/**
 * SearchSelect — ghost "+ add" button that opens a searchable checklist dropdown.
 *
 * Replaces the duplicated open-dropdown-with-search-and-checkmarks blocks in the
 * drawer (link branch, add driving licence). Multi-select by default: clicking an
 * option toggles it in `selected` via `onToggle`. Closes on outside click.
 *
 * Flip + clamp (Danny screenshot, kandidaten-ronde-2 — the "+ Vestiging" branches
 * picker at the bottom of AddCandidateModal rendered a downward popover that got
 * clipped by the modal's own `overflow: hidden`): placement is the ONE shared
 * `useDropdownPlacement` hook (also used by CreatableSelect) — never a second
 * copy of this math. The option list keeps its own `overflow-y: auto` sized to
 * match, so every item stays scrollable and selectable, never truncated off.
 */
import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Plus, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDropdownPlacement, DROPDOWN_SEARCH_ROW_HEIGHT } from '@/lib/useDropdownPlacement'

interface SearchSelectOption {
  value: string
  label: string
}

interface SearchSelectProps {
  triggerLabel?: ReactNode
  options?: Array<string | SearchSelectOption>
  selected?: Array<string | number>
  onToggle: (value: string) => void
  searchable?: boolean
  width?: number
  onSearch?: (query: string) => void
  // Opt-in trigger override (candidates' DrawerAddButton reference style, 2026-07
  // consistency sweep) — receives the open/close toggle. Omitted = the default
  // ghost "+" button below, so existing callers are untouched.
  renderTrigger?: (toggle: () => void) => ReactNode
  // Anchor the dropdown to the trigger's right edge for right-aligned triggers
  // (keeps the menu inside the drawer). Default 'left' = current behaviour.
  menuAlign?: 'left' | 'right'
}

export default function SearchSelect({
  triggerLabel, options = [], selected = [], onToggle, searchable = true, width = 280, onSearch, renderTrigger, menuAlign = 'left',
}: SearchSelectProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  // Shared flip + clamp placement (see the module doc comment above).
  const { openUp, maxHeight: menuMaxHeight } = useDropdownPlacement(ref, open)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Server-side search: when onSearch is given, debounce the query up to the parent
  // (which re-fetches a capped list) and skip the local filter — so we never pull
  // the whole table into the client.
  useEffect(() => {
    if (!onSearch) return
    const id = setTimeout(() => onSearch(query), 250)
    return () => clearTimeout(id)
  }, [query, onSearch])

  const opts: SearchSelectOption[] = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  const shown = onSearch ? opts : (query ? opts.filter(o => o.label.toLowerCase().includes(query.toLowerCase())) : opts)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {renderTrigger
        ? renderTrigger(() => setOpen(o => !o))
        : (
          <button onClick={() => setOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 11, fontWeight: 500,
              border: '1px dashed var(--border)', borderRadius: 7, background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <Plus size={11} /> {triggerLabel}
          </button>
        )}
      {open && (
        // minWidth + viewport cap: the menu grows with long option labels instead of
        // truncating. Flips upward + clamps to the available space (see doc comment).
        <div style={{ position: 'absolute', ...(openUp ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }),
          ...(menuAlign === 'right' ? { right: 0 } : { left: 0 }), zIndex: 200, minWidth: width, maxWidth: 'min(420px, 90vw)', maxHeight: menuMaxHeight,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          {searchable && (
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search')} aria-label={t('search')} autoFocus
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none' }} />
            </div>
          )}
          <div style={{ maxHeight: menuMaxHeight - (searchable ? DROPDOWN_SEARCH_ROW_HEIGHT : 0), overflowY: 'auto' }}>
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
