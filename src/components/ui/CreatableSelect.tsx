/**
 * CreatableSelect — a single-select dropdown with a search box that can also
 * create a new value (combobox). Pick from the managed list, or type a value and
 * add it via the "+" row / Enter. Set `allowCreate={false}` for a strict dropdown.
 *
 * One stored value (a string) regardless of mode — no second field. Closes on
 * outside click. Styling matches SelectMenu so pickers look consistent.
 *
 * CLEAR (VAC-CLEAR-1, Danny: "gekozen waarde weer leegmaken"): pass `clearable`
 * to get an X that emits the empty value. Opt-in on purpose — the component is
 * shared by ~90 call sites, and a picker may only offer "unset" where the caller
 * genuinely persists an empty value (§3 no fake affordances).
 *
 * PORTAL (Danny, live: the drawer's Profiel-tab province/country picker still
 * rendered "incomplete", cut off): a field near the bottom of a scrollable panel
 * used to render a downward popover that got clipped by that panel's own
 * `overflow` ancestor — flipping up did NOT help there, because it still flips
 * INSIDE the same clipped box, and neither does z-index (an overflow ancestor
 * clips regardless of stacking order). The popover now renders through
 * `createPortal` into `document.body`, escaping every overflow ancestor
 * entirely, positioned with `position: fixed` off the anchor's own measured
 * rect (`useDropdownPlacement`, shared with SearchSelect — CLAUDE.md §11: never
 * a second copy of this math). The option list keeps its own `overflow-y: auto`
 * sized to match the clamp, so every item (however long the list) stays
 * scrollable and selectable, never truncated off.
 */
import { useState, useRef, useEffect, useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ChevronDown, Check, Plus } from 'lucide-react'
import { DROPDOWN_SEARCH_ROW_HEIGHT } from '@/lib/useDropdownPlacement'
import { useDropdownPopover } from '@/hooks/useDropdownPopover'
import { matchesOptionQuery } from './optionFilter'
import SelectClearButton, { CLEAR_BUTTON_SIZE } from './SelectClearButton'
import DropdownPopover from './DropdownPopover'

// Footprint of the opt-in clear button: a 24px WCAG 2.2 (2.5.8) target, parked
// left of the chevron. The label span reserves exactly this much extra room so a
// long value ellipsises BEFORE the X instead of sliding underneath it.

interface CreatableOption {
  value: string
  label: string
  // Optional lookup icon (S-icon-1, mirrored from SelectMenu) — rendered before
  // the label, both on the trigger (when selected) and in each menu row. Purely
  // additive: options without it (every existing call site) render unchanged.
  icon?: ReactNode
}

interface CreatableSelectProps {
  // Supplied by the shared Field wrapper (§6): `id` names the trigger, and
  // aria-labelledby points at the visible label — a <button> is not labelable, so
  // without it the picker announced its value with no field name.
  id?: string
  'aria-labelledby'?: string
  // REQUIRED-A11Y-2: forwarded onto the trigger button so a required picker
  // announces to assistive tech (fields.tsx clones this from Field/FieldRow).
  'aria-required'?: boolean
  value?: string | null
  options?: Array<string | CreatableOption>
  onChange: (value: string) => void
  placeholder?: string
  allowCreate?: boolean
  menuWidth?: number
  style?: CSSProperties
  // DROPDOWN-CLEAR-1 (Danny 08-09, supersedes VAC-CLEAR-1's opt-in): the X is ON by
  // default on every picker and renders only while a value is actually set. Opt
  // out ONLY where clearing would persist an empty value the record must not hold
  // (an in-place editor on a required field) — with a `// DROPDOWN-CLEAR-1:` reason
  // above the call site; dropdownClear.houseStyle.test.js enforces the comment.
  clearable?: boolean
  // Field name woven into the clear button's accessible name ("Klantlocatie
  // wissen"), so several clearable pickers on one card don't all announce as a
  // bare "Wissen". Composed via ICU interpolation, never string concatenation (§5).
  clearLabel?: string
  // HUISSTIJL-1: opt-in trigger override (mirrors SearchSelect's own
  // `renderTrigger`), for the handful of FILTER-role call sites that must wear
  // the house trio pill instead of the calm form-field box below. Receives the
  // open/close toggle; omitted = the existing bordered trigger, so every
  // FORM-role call site (pick a value to save) renders byte-for-byte unchanged.
  renderTrigger?: (toggle: () => void) => ReactNode
  // W30: opt-in server-side search (mirrors SearchSelect's own `onSearch`) — the
  // typed query is debounced and forwarded here instead of filtering `options`
  // locally, for pickers whose full list is too large to load in one page.
  // Omitted (every existing call site) keeps the current client-side filter.
  onSearch?: (query: string) => void
}

// The house searchable-dropdown that can also add a value (never a bare <select>,
// §3A) — owns its own open/close, outside-click, Escape and focus-restore wiring.
export default function CreatableSelect({
  id, 'aria-labelledby': ariaLabelledBy, 'aria-required': ariaRequired,
  value, options = [], onChange, placeholder, allowCreate = true, menuWidth = 220, style,
  clearable = true, clearLabel, renderTrigger, onSearch,
}: CreatableSelectProps) {
  const listId = useId()
  const autoId = useId()
  const triggerId = id ?? autoId
  // ROLE-PICKER-LEFT-1 (measured 04-09 in jsdom/dom-accessibility-api, the engine
  // every RTL name query runs on): inside Field/FieldRow, whose <label htmlFor>
  // targets this trigger, the self-reference below contributes NOTHING, so the
  // accessible NAME is the label alone ("Status") and that is exactly what every
  // Field/FieldRow call site and its tests query. Only a bare <label id>
  // without htmlFor makes the self-reference append the button's own text
  // ("Status Planner"), so it stays and the direct call sites keep their names
  // as they are. The CURRENT VALUE is exposed as the accessible DESCRIPTION
  // instead (aria-describedby → the inner value span): a screen reader announces
  // it after the name in BOTH shapes, without renaming any control.
  const valueId = `${triggerId}-value`
  const labelledBy = ariaLabelledBy ? `${ariaLabelledBy} ${triggerId}` : undefined
  const describedBy = ariaLabelledBy ? valueId : undefined
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Shared portal/placement/close-on-outside-click/Escape/focus-restore wiring
  // (see the hook's own doc comment) — menuRef must ALSO count as "inside" for
  // the outside-click check, or picking an option would self-close first.
  const { menuRef, openUp, maxHeight: menuMaxHeight, rect } = useDropdownPopover(ref, open, () => setOpen(false), () => triggerRef.current)

  // Focus the search box when opening.
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  // W30: server-side search — when `onSearch` is given, debounce the typed query
  // up to the parent (mirrors SearchSelect's identical debounce) instead of
  // filtering `options` locally below.
  useEffect(() => {
    if (!onSearch) return
    const id = setTimeout(() => onSearch(query), 250)
    return () => clearTimeout(id)
  }, [query, onSearch])

  const opts: CreatableOption[] = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  const current = opts.find(o => o.value === value)
  const q = query.trim()
  const ql = q.toLowerCase()
  // W30: server-search callers already filtered `opts` themselves — filtering
  // again locally would double-narrow on a query the server already applied.
  const filtered = onSearch ? opts : opts.filter(o => matchesOptionQuery(o.label, query))
  const exists = opts.some(o => o.label.toLowerCase() === ql)
  const canCreate = allowCreate && q.length > 0 && !exists

  const pick = (v: string) => { onChange(v); setOpen(false); setQuery('') }

  // The clear affordance only exists once something is actually picked — an unset
  // field shows the placeholder and nothing to press. `''` is the empty value
  // every caller's form state already uses (never null: onChange is (string)=>void).
  const hasValue = value != null && value !== ''
  const showClear = clearable && hasValue

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* HUISSTIJL-1: a caller-supplied trigger (FILTER role) replaces the default
          button entirely — same toggle, same portal/menu logic below, only the
          face changes. FORM-role callers never pass this, so they render exactly
          as before. */}
      {renderTrigger ? renderTrigger(() => setOpen(o => !o)) : (
        // Announced as a disclosure, NOT role="combobox": the options are real focusable
        // buttons reached by Tab, so claiming the combobox role would promise the arrow-key
        // + aria-activedescendant model this component does not implement. haspopup/expanded
        // tell a screen reader it opens a list — the part that was missing entirely once a
        // native <select> was replaced by this (measured 27-07).
        <button type="button" ref={triggerRef} onClick={() => setOpen(o => !o)}
          id={triggerId} aria-labelledby={labelledBy} aria-describedby={describedBy} aria-required={ariaRequired || undefined}
          aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? listId : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', width: '100%',
            boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--surface)', cursor: 'pointer', ...style }}>
          {/* The trigger label follows an explicit style.fontSize (modal-sized fields).
              `marginRight` (NOT the button's padding) reserves the clear button's slot:
              padding would push the chevron inward too, and it would also be overridable
              by a caller's own `style`. Applied only while the X is showing, so a caller
              that never opts in keeps its exact current layout. */}
          {/* S-icon-1 (mirrored from SelectMenu): the selected option's own icon, if any. */}
          {current?.icon && <span style={{ display: 'flex', flexShrink: 0 }}>{current.icon}</span>}
          <span id={valueId} style={{ fontSize: (style as { fontSize?: number } | undefined)?.fontSize ?? 12, flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden',
            textOverflow: 'ellipsis', color: (current || value) ? 'var(--text)' : 'var(--text-muted)',
            ...(showClear ? { marginRight: CLEAR_BUTTON_SIZE } : {}) }}>
            {/* `value || placeholder`, NOT `value ?? placeholder`: an unset field commonly
                holds an EMPTY STRING (form state seeded with ''), which ?? happily renders —
                leaving the trigger with no text at all. The placeholder then never showed AND
                the box collapsed ~8px shorter than the text inputs beside it (measured live
                28-07 on the contact modal's Functie field: 30px vs 38px, Danny's "het veld is
                niet even groot als de rest"). Every picker seeded with '' had it. */}
            {current?.label ?? (value || placeholder) ?? '-'}
          </span>
          <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </button>
      )}
      {/* DROPDOWN-CLEAR-1: the shared clear control; clearing is treated exactly like
          a pick — emit the empty value and close. */}
      {showClear && (
        <SelectClearButton triggerId={triggerId} clearLabel={clearLabel} aria-labelledby={ariaLabelledBy}
          onClear={() => { onChange(''); setOpen(false); setQuery('') }} />
      )}
      {/* PERF (r11 v2): short-circuit here, not inside DropdownPopover — a closed
          picker must never build this option list at all. */}
      {open && (
      <DropdownPopover menuRef={menuRef} style={{
          // HUISSTIJL-1: portalled dropdown menu — z-popover ladder tier, shadow-float role.
          position: 'fixed', zIndex: 'var(--z-popover)', minWidth: menuWidth, maxHeight: menuMaxHeight,
          // Hidden until the first measurement lands (see useDropdownPlacement's
          // doc comment) — never painted at an unpositioned (0,0) spot.
          visibility: rect ? 'visible' : 'hidden',
          left: rect ? rect.left : 0,
          ...(rect
            ? (openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 })
            : {}),
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: 'var(--shadow-float)', overflow: 'hidden' }}>
          {/* Search / type-to-create */}
          <div style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canCreate) pick(q) }}
              placeholder={placeholder} aria-label={placeholder} aria-labelledby={placeholder ? undefined : ariaLabelledBy}
              style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 12,
                border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
          </div>
          <div id={listId}
            style={{ maxHeight: menuMaxHeight - DROPDOWN_SEARCH_ROW_HEIGHT, overflowY: 'auto' }}>
            {filtered.map(o => (
              <button key={o.value} type="button" onClick={() => pick(o.value)}
                aria-current={value === o.value}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                  textAlign: 'left', fontSize: 12, cursor: 'pointer', border: 'none',
                  background: value === o.value ? 'var(--color-primary-bg)' : 'none', color: 'var(--text)' }}>
                {/* S-icon-1: each row shows its own option icon, if any. */}
                {o.icon && <span style={{ display: 'flex', flexShrink: 0 }}>{o.icon}</span>}
                <span style={{ flex: 1 }}>{o.label}</span>
                {value === o.value && <Check size={13} style={{ color: 'var(--color-primary-text)', flexShrink: 0 }} />}
              </button>
            ))}
            {canCreate && (
              <button type="button" onClick={() => pick(q)} title={q}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px',
                  textAlign: 'left', fontSize: 12, cursor: 'pointer', border: 'none',
                  borderTop: filtered.length ? '1px solid var(--border)' : 'none',
                  background: 'none', color: 'var(--color-primary-text)', fontWeight: 600 }}>
                <Plus size={13} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{q}”</span>
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>—</div>
            )}
          </div>
      </DropdownPopover>
      )}
    </div>
  )
}
