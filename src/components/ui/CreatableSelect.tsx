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
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Check, Plus, X } from 'lucide-react'
import { useDropdownPlacement, DROPDOWN_SEARCH_ROW_HEIGHT, DROPDOWN_PORTAL_Z_INDEX, DROPDOWN_PORTAL_ATTR } from '@/lib/useDropdownPlacement'

// Footprint of the opt-in clear button: a 24px WCAG 2.2 (2.5.8) target, parked
// left of the chevron. The label span reserves exactly this much extra room so a
// long value ellipsises BEFORE the X instead of sliding underneath it.
const CLEAR_BUTTON_SIZE = 24
const CLEAR_BUTTON_RIGHT = 26

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
  value?: string | null
  options?: Array<string | CreatableOption>
  onChange: (value: string) => void
  placeholder?: string
  allowCreate?: boolean
  menuWidth?: number
  style?: CSSProperties
  // VAC-CLEAR-1: opt-in "unset this value" affordance. OFF by default because this
  // component is shared by ~90 call sites — an always-on X would silently reshape
  // every one of them (and clearing is only honest where the caller really persists
  // an empty value). Renders only while a value is actually set.
  clearable?: boolean
  // Field name woven into the clear button's accessible name ("Klantlocatie
  // wissen"), so several clearable pickers on one card don't all announce as a
  // bare "Wissen". Composed via ICU interpolation, never string concatenation (§5).
  clearLabel?: string
}

export default function CreatableSelect({
  id, 'aria-labelledby': ariaLabelledBy,
  value, options = [], onChange, placeholder, allowCreate = true, menuWidth = 220, style,
  clearable = false, clearLabel,
}: CreatableSelectProps) {
  const { t } = useTranslation('common')
  const listId = useId()
  const autoId = useId()
  const triggerId = id ?? autoId
  // Name = the field's label PLUS this button's own text (the current value); pointing
  // aria-labelledby at the label alone would REPLACE the value instead of prefixing it.
  const labelledBy = ariaLabelledBy ? `${ariaLabelledBy} ${triggerId}` : undefined
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  // The portalled popover lives outside `ref`'s DOM subtree — its own ref must
  // ALSO count as "inside" for the outside-click check below, or picking an
  // option (a click that lands inside the portal, not inside `ref`) would
  // immediately self-close before the click handler even runs.
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Shared flip + clamp + rect placement (see the module doc comment above).
  const { openUp, maxHeight: menuMaxHeight, rect } = useDropdownPlacement(ref, open)

  // Close on outside click; focus the search box when opening.
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
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  // Document-level, CAPTURE-phase Escape (mirrors SelectMenu — see its doc comment
  // for the full rationale): closes the popover even right after opening, before
  // focus has moved into the portalled search input, instead of relying solely on
  // that input's own onKeyDown (which only fires once focus already landed there).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  // Restore focus to the trigger whenever the popover transitions open → closed
  // (pick / Escape / outside click — the search input unmounts with the portal
  // on every one of those paths, so focus would otherwise land nowhere). Never
  // on unmount, since that never runs this transition. Skipped if some OTHER
  // element already claimed focus (e.g. the outside click landed on a
  // different picker's own trigger) so this never yanks focus away from what
  // the user just interacted with.
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (wasOpenRef.current && !open && (document.activeElement === document.body || document.activeElement == null)) {
      triggerRef.current?.focus()
    }
    wasOpenRef.current = open
  }, [open])

  const opts: CreatableOption[] = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  const current = opts.find(o => o.value === value)
  const q = query.trim()
  const ql = q.toLowerCase()
  const filtered = ql ? opts.filter(o => o.label.toLowerCase().includes(ql)) : opts
  const exists = opts.some(o => o.label.toLowerCase() === ql)
  const canCreate = allowCreate && q.length > 0 && !exists

  const pick = (v: string) => { onChange(v); setOpen(false); setQuery('') }

  // The clear affordance only exists once something is actually picked — an unset
  // field shows the placeholder and nothing to press. `''` is the empty value
  // every caller's form state already uses (never null: onChange is (string)=>void).
  const hasValue = value != null && value !== ''
  const showClear = clearable && hasValue
  const clearId = `${triggerId}-clear`
  const clearName = clearLabel ? t('clearField', { field: clearLabel }) : t('clear')

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Announced as a disclosure, NOT role="combobox": the options are real focusable
          buttons reached by Tab, so claiming the combobox role would promise the arrow-key
          + aria-activedescendant model this component does not implement. haspopup/expanded
          tell a screen reader it opens a list — the part that was missing entirely once a
          native <select> was replaced by this (measured 27-07). */}
      <button type="button" ref={triggerRef} onClick={() => setOpen(o => !o)}
        id={triggerId} aria-labelledby={labelledBy}
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
        <span style={{ fontSize: (style as { fontSize?: number } | undefined)?.fontSize ?? 12, flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden',
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
      {/* Clear — a SIBLING of the trigger, never a child: a <button> inside a
          <button> is invalid HTML and browsers drop the inner one from the tab
          order. Absolutely positioned over the trigger's reserved slot, so it is
          a real focusable control (Tab reaches it, Enter/Space fire it) with a
          text accessible name — an icon-only div would have neither (§6).
          Clearing is treated exactly like a pick: emit the empty value and close. */}
      {showClear && (
        <button type="button" id={clearId} title={clearName}
          aria-labelledby={ariaLabelledBy && !clearLabel ? `${clearId} ${ariaLabelledBy}` : undefined}
          onClick={() => { onChange(''); setOpen(false); setQuery('') }}
          style={{ position: 'absolute', right: CLEAR_BUTTON_RIGHT, top: '50%', transform: 'translateY(-50%)',
            width: CLEAR_BUTTON_SIZE, height: CLEAR_BUTTON_SIZE, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 0, border: 'none', borderRadius: 6,
            background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={12} aria-hidden="true" />
          <span className="sr-only">{clearName}</span>
        </button>
      )}
      {open && createPortal(
        <div ref={menuRef} {...{ [DROPDOWN_PORTAL_ATTR]: '' }} style={{
          position: 'fixed', zIndex: DROPDOWN_PORTAL_Z_INDEX, minWidth: menuWidth, maxHeight: menuMaxHeight,
          // Hidden until the first measurement lands (see useDropdownPlacement's
          // doc comment) — never painted at an unpositioned (0,0) spot.
          visibility: rect ? 'visible' : 'hidden',
          left: rect ? rect.left : 0,
          ...(rect
            ? (openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 })
            : {}),
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {/* Search / type-to-create */}
          <div style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canCreate) pick(q); if (e.key === 'Escape') setOpen(false) }}
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
        </div>,
        document.body,
      )}
    </div>
  )
}
