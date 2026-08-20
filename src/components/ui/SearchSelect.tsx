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
import { Check, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDropdownPlacement, DROPDOWN_SEARCH_ROW_HEIGHT, DROPDOWN_PORTAL_ATTR } from '@/lib/useDropdownPlacement'
import SelectAllRow, { SELECT_ALL_ROW_HEIGHT } from './SelectAllRow'
import { useBatchToggle } from '@/hooks/useBatchToggle'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'

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
  // Herhaal-audit r4 (findings 5/6/7): an accessible-name override for the DEFAULT
  // trigger face, for the case where the visible label is only the picked VALUE
  // (e.g. "Read") while an adjacent element already names what it configures — the
  // renderTrigger call sites this default face replaces relied on their own
  // aria-label for exactly that. Optional: omitted keeps the visible text as the
  // accessible name, unchanged for every existing caller.
  triggerAriaLabel?: string
  // Lock the whole control inert (e.g. a field-type selector once data exists).
  // The default trigger gets the real native `disabled` attribute (keyboard,
  // click and focus all inert, aria-disabled for free); a caller's own
  // `renderTrigger` markup is dimmed + pointer-blocked, and — the part that
  // matters most — opening is gated centrally below, so no callsite ever needs
  // its own onClick guard again.
  disabled?: boolean
  // "Select all / clear all" row above the option list (Danny punt 7). Left
  // undefined it resolves to `!closeOnToggle`: this component IS the house
  // multi-select checklist, and `closeOnToggle` is precisely the flag the
  // single-pick usages set (one click closes the menu), so every real multi-select
  // call site gets the action with NO change of its own. The handful of single-pick
  // pickers that never needed that flag opt out with `selectAll={false}` — a
  // select-all in a one-of-N list is meaningless (§3).
  selectAll?: boolean
}

export default function SearchSelect({
  triggerLabel, options = [], selected = [], onToggle, searchable = true, width = 280, onSearch, renderTrigger, menuAlign = 'left', closeOnToggle = false, disabled = false, selectAll, triggerAriaLabel,
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

  // Document-level, CAPTURE-phase Escape (mirrors SelectMenu — see its doc comment
  // for the full rationale): closes the popover no matter which element inside it
  // holds focus — an option button, not just the search input — since only the
  // search input's own onKeyDown previously handled the key.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  // Restore focus to the trigger whenever the popover transitions open → closed —
  // the search input lives in a PORTAL and unmounts on every close path, so focus
  // would otherwise land on <body>. Inside a modal that is not cosmetic: the house
  // focus trap listens on the modal's own node, and a portal is not a descendant of
  // it, so from <body> neither Escape nor Tab reaches the dialog again (§6). Skipped
  // when some other element already claimed focus — same rule CreatableSelect
  // documents for the identical situation; never a second behaviour for one idiom.
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (wasOpenRef.current && !open && (document.activeElement === document.body || document.activeElement == null)) {
      ref.current?.querySelector<HTMLElement>('button, [tabindex]:not([tabindex="-1"])')?.focus()
    }
    wasOpenRef.current = open
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

  // Single gate for opening — disabled short-circuits both the default trigger
  // and any caller-supplied `renderTrigger` button, so `open` can never become
  // true while disabled, regardless of how the trigger tries to invoke it.
  const toggle = () => { if (!disabled) setOpen(o => !o) }

  // Multi-select only (see the `selectAll` prop doc above), applied one value per
  // commit because most call sites' onToggle is a stale-closure setState.
  const showSelectAll = selectAll ?? !closeOnToggle
  const applyBatch = useBatchToggle<string>(onToggle)
  // Reserve the row's height in the option list's own cap, so adding it never
  // pushes the last option outside the menu's clamped max height.
  const listMaxHeight = menuMaxHeight
    - (searchable ? DROPDOWN_SEARCH_ROW_HEIGHT : 0)
    - (showSelectAll && shown.length > 0 ? SELECT_ALL_ROW_HEIGHT : 0)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {renderTrigger
        ? (disabled
          // Caller owns this markup; only wrap it when disabled, so every existing
          // renderTrigger callsite (16+ across Settings) renders byte-for-byte as
          // before — the wrapper (dim + block pointer interaction) is new, opt-in
          // behaviour, never a layout change for callers that never pass `disabled`.
          ? <div style={{ opacity: 0.5, cursor: 'default', pointerEvents: 'none' }}>{renderTrigger(toggle)}</div>
          : renderTrigger(toggle))
        : (
          // Two roles, two looks (Opus F review — the first attempt applied one
          // look to both): closeOnToggle marks the SINGLE-PICK FIELD role, which
          // wears calm form chrome (value + chevron, no plus); everything else is
          // a genuine ADD affordance and renders the REAL DrawerAddButton
          // (PRIMAIR-VLAK-1 + §3A), never a hand-copy of it.
          closeOnToggle ? (
            // This IS the canonical single-pick FIELD trigger (herhaal-audit r4,
            // findings 5/6/7) — a dropdown trigger is a form field, not an action
            // button, so it deliberately does not read components/ui/Button; every
            // renderTrigger call site this default face replaces should adopt THIS,
            // never hand-paint its own copy. Block form: style spans several lines.
            /* eslint-disable huisstijlLegacy/no-restricted-syntax */
            <button type="button" onClick={toggle} disabled={disabled} aria-label={triggerAriaLabel}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)',
                cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
              <span style={{ fontSize: 12, flex: 1, textAlign: 'left', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>{triggerLabel}</span>
              <ChevronDown size={12} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>
            /* eslint-enable huisstijlLegacy/no-restricted-syntax */
          ) : (
            <DrawerAddButton label={triggerLabel ?? ''} onClick={toggle} disabled={disabled} />
          )
        )}
      {open && createPortal(
        // minWidth + viewport cap: the menu grows with long option labels instead of
        // truncating. Flips upward + clamps to the available space (see doc comment).
        <div ref={menuRef} {...{ [DROPDOWN_PORTAL_ATTR]: '' }} style={{
          // HUISSTIJL-1: portalled dropdown menu — z-popover ladder tier, shadow-float role.
          position: 'fixed', zIndex: 'var(--z-popover)', minWidth: width, maxWidth: 'min(420px, 90vw)', maxHeight: menuMaxHeight,
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
          boxShadow: 'var(--shadow-float)', overflow: 'hidden' }}>
          {searchable && (
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              {/* Escape closes the innermost open thing — this menu — instead of doing
                  nothing (the portal sits outside any host modal's focus trap, so the
                  key never reached a handler at all). Mirrors CreatableSelect's input. */}
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search')} aria-label={t('search')} autoFocus
                onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none' }} />
            </div>
          )}
          {/* Select-all acts on `shown` — the search-filtered options, never the
              full list (SelectAllRow's own doc comment explains why). */}
          {showSelectAll && (
            <SelectAllRow visibleValues={shown.map(o => o.value)} selectedValues={selected}
              onApply={values => applyBatch(values)} />
          )}
          <div style={{ maxHeight: listMaxHeight, overflowY: 'auto' }}>
            {shown.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('noResults')}</div>
            )}
            {shown.map(o => {
              const isSel = selected.includes(o.value)
              return (
                // A dropdown OPTION row — a menu item, not a standalone action; the
                // "selected list row" tint exemption DrawerFilterMenu's own checklist
                // rows already document applies here too. Block form: style spans
                // several lines.
                /* eslint-disable huisstijlLegacy/no-restricted-syntax */
                <button key={o.value} onClick={() => { onToggle(o.value); if (closeOnToggle) setOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                    padding: '9px 12px', fontSize: 12, textAlign: 'left', cursor: 'pointer', border: 'none',
                    background: isSel ? 'var(--color-primary-bg)' : 'none', color: 'var(--text)' }}>
                  {o.label}
                  {isSel && <Check size={13} style={{ color: 'var(--color-primary-text)', flexShrink: 0 }} />}
                </button>
                /* eslint-enable huisstijlLegacy/no-restricted-syntax */
              )
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
