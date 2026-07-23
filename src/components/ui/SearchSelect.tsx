/**
 * SearchSelect — ghost "+ add" button that opens a searchable checklist dropdown.
 *
 * Replaces the duplicated open-dropdown-with-search-and-checkmarks blocks in the
 * drawer (link branch, add driving licence). Multi-select by default: clicking an
 * option toggles it in `selected` via `onToggle`. Closes on outside click.
 *
 * PORTAL (Danny, live: the drawer's Profiel-tab picker rendered "incomplete",
 * cut off, and the +Kandidaat modal's "+ Vestiging" picker hit the same thing at
 * the bottom of the form): a downward popover used to get clipped by whichever
 * `overflow` ancestor it sat inside (a drawer's scroll container OR the modal's
 * own `overflow: hidden`) — flipping up did not help there, since it still flips
 * INSIDE the same clipped box, and z-index does not help either (an overflow
 * ancestor clips regardless of stacking order). The popover now renders through
 * `createPortal` into `document.body`, escaping every overflow ancestor
 * entirely, positioned with `position: fixed` off the anchor's own measured
 * rect (`useDropdownPlacement`, shared with CreatableSelect — CLAUDE.md §11:
 * never a second copy of this math). The option list keeps its own
 * `overflow-y: auto` sized to match, so every item stays scrollable and
 * selectable, never truncated off.
 */
import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDropdownPlacement, DROPDOWN_SEARCH_ROW_HEIGHT, DROPDOWN_PORTAL_Z_INDEX } from '@/lib/useDropdownPlacement'

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
  // Opt-in: close the menu after a pick — single-select dropdowns (Conversie).
  closeOnToggle?: boolean
}

export default function SearchSelect({
  triggerLabel, options = [], selected = [], onToggle, searchable = true, width = 280, onSearch, renderTrigger, menuAlign = 'left', closeOnToggle = false,
}: SearchSelectProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  // The portalled popover lives outside `ref`'s DOM subtree — its own ref must
  // ALSO count as "inside" for the outside-click check below, or toggling an
  // option (a click that lands inside the portal, not inside `ref`) would
  // immediately self-close before the click handler even runs.
  const menuRef = useRef<HTMLDivElement>(null)
  // Shared flip + clamp + rect placement (see the module doc comment above).
  const { openUp, maxHeight: menuMaxHeight, rect } = useDropdownPlacement(ref, open)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
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
      {open && createPortal(
        // minWidth + viewport cap: the menu grows with long option labels instead of
        // truncating. Flips upward + clamps to the available space (see doc comment).
        <div ref={menuRef} style={{
          position: 'fixed', zIndex: DROPDOWN_PORTAL_Z_INDEX, minWidth: width, maxWidth: 'min(420px, 90vw)', maxHeight: menuMaxHeight,
          // Hidden until the first measurement lands — never painted at an
          // unpositioned (0,0) spot (see useDropdownPlacement's doc comment).
          visibility: rect ? 'visible' : 'hidden',
          ...(rect
            ? {
                ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
                // Right-aligned: fix the popover's RIGHT edge at the anchor's right
                // edge (viewport coords) instead of its left edge — keeps a
                // right-aligned trigger's menu from running off the right side.
                ...(menuAlign === 'right' ? { right: window.innerWidth - rect.right } : { left: rect.left }),
              }
            : { left: 0 }),
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
                <button key={o.value} onClick={() => { onToggle(o.value); if (closeOnToggle) setOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                    padding: '9px 12px', fontSize: 12, textAlign: 'left', cursor: 'pointer', border: 'none',
                    background: isSel ? 'var(--color-primary-bg)' : 'none', color: 'var(--text)' }}>
                  {o.label}
                  {isSel && <Check size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
