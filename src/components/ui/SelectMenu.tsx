/**
 * SelectMenu — single-select dropdown: a button showing the current option that
 * opens a checklist. Closes on outside click or Escape, and restores focus to
 * the trigger on close so a keyboard user never loses their place (§6).
 *
 * Reusable header-style picker (status, candidate type, owner, …). Options may
 * carry `initials` to render an Avatar (e.g. the owner/recruiter picker), so one
 * component covers plain and avatar pickers alike.
 */
import type { CSSProperties } from 'react'
import { useState, useRef, useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import Avatar from './Avatar'
import { useDropdownPopover } from '@/hooks/useDropdownPopover'
import { menuShellStyle } from '@/lib/useDropdownPlacement'
import { matchesOptionQuery } from './optionFilter'
import SelectClearButton, { CLEAR_BUTTON_SIZE } from './SelectClearButton'
import DropdownPopover from './DropdownPopover'

interface SelectOption {
  value: string
  label: ReactNode
  initials?: string
  // Optional lookup icon (S-icon-1) — rendered before the label, both on the
  // trigger (when selected) and in each menu row. Purely additive: callers that
  // never pass it see no layout/behaviour change.
  icon?: ReactNode
  // A row that is shown for context but cannot be chosen — e.g. the current owner
  // when they are not in the selectable list. Without this it rendered as an ordinary
  // clickable button whose handler silently did nothing, which reads as broken (§3).
  disabled?: boolean
}

interface SelectMenuProps {
  // Handed down by the shared Field wrapper so the visible label names this
  // picker (a <button> is not labelable — see CreatableSelect for the full note).
  id?: string
  'aria-labelledby'?: string
  // REQUIRED-A11Y-2: forwarded onto the trigger button so a required picker
  // announces to assistive tech (fields.tsx clones this from Field/FieldRow).
  'aria-required'?: boolean
  value?: string | null
  options?: Array<string | SelectOption>
  onChange: (value: string) => void
  placeholder?: string
  leading?: ReactNode
  menuWidth?: number
  // Optional trigger override (modal-sized fields honour style.fontSize too).
  style?: CSSProperties
  // DROPDOWN-CLEAR-1 (Danny 08-09): the X is ON by default and renders only while a
  // value is set; clearing emits '' exactly like a pick. Opt out only where an empty
  // value must never persist, with a `// DROPDOWN-CLEAR-1:` reason above the call site.
  clearable?: boolean
  clearLabel?: string
}

// Trigger button + portal checklist; closes on outside click/Escape and returns focus to the trigger so keyboard users keep their place.
export default function SelectMenu({ id, 'aria-labelledby': ariaLabelledBy, 'aria-required': ariaRequired, value, options = [], onChange, placeholder, leading, menuWidth = 170, style, clearable = true, clearLabel }: SelectMenuProps) {
  const listId = useId()
  const autoId = useId()
  const triggerId = id ?? autoId
  // See CreatableSelect (ROLE-PICKER-LEFT-1): the NAME stays exactly as it was
  // (the label alone under a <label htmlFor>, label + own text under a bare
  // <label id>); the current value rides as the accessible DESCRIPTION via
  // aria-describedby → the value span, so it is announced in both shapes.
  const valueId = `${triggerId}-value`
  const labelledBy = ariaLabelledBy ? `${ariaLabelledBy} ${triggerId}` : undefined
  const describedBy = ariaLabelledBy ? valueId : undefined
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // PORTAL (S24a class fix, 13-08): the menu used to be position:absolute inside
  // the tree, so ANY overflow ancestor (FloatingPanel scroll body, drawer tab)
  // clipped it at its own box. Same cure as CreatableSelect: portal into
  // document.body + fixed positioning off the shared flip/clamp hook — all
  // wired by the shared useDropdownPopover hook (menuRef, placement, close-on-
  // outside-click/Escape, focus-restore; see its own doc comment).
  const { menuRef, openUp, maxHeight: menuMaxHeight, rect } = useDropdownPopover(ref, open, () => setOpen(false), () => triggerRef.current)

  const opts: SelectOption[] = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  const current = opts.find(o => o.value === value)
  // DROPDOWN-CLEAR-1: only a picked value can be unset (an empty field shows the placeholder).
  const showClear = clearable && value != null && value !== ''
  // SEARCHABLE-ALWAYS (Danny 08-08, CLAUDE.md §4: "zoekbare dropdowns overal waar
  // we een dropdown hebben"): every menu filters, including the short ones — so a
  // picker feels the same wherever you meet it. Filtering happens here rather
  // than at 40+ call sites; the trigger, value contract and onChange are
  // untouched, so no consumer changes.
  const [query, setQuery] = useState('')
  const shown = opts.filter(o => matchesOptionQuery(o.label, query))
  // A fresh open always starts unfiltered — a stale query would hide options.
  useEffect(() => { if (!open) setQuery('') }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Same disclosure semantics as CreatableSelect — one picker convention, so a
          screen reader describes both identically (§6). */}
      {/* HUISSTIJL-1: ONE trigger recipe shared with CreatableSelect (was var(--bg)/r7
          here vs var(--surface)/r6 there) — background var(--surface), border
          1px solid var(--border), radius 6, padding '6px 10px'. */}
      <button ref={triggerRef} type="button" onClick={() => setOpen(o => !o)}
        id={triggerId} aria-labelledby={labelledBy} aria-describedby={describedBy} aria-required={ariaRequired || undefined}
        aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? listId : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', width: '100%',
          border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer' , ...style }}>
        {leading}
        {current?.initials && <Avatar initials={current.initials} size={18} />}
        {current?.icon && !current.initials && <span style={{ display: 'flex', flexShrink: 0 }}>{current.icon}</span>}
        <span id={valueId} style={{ fontSize: (style as { fontSize?: number } | undefined)?.fontSize ?? 12, flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis', color: current ? 'var(--text)' : 'var(--text-muted)',
          ...(showClear ? { marginRight: CLEAR_BUTTON_SIZE } : {}) }}>
          {current?.label ?? placeholder ?? '-'}
        </span>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>
      {/* DROPDOWN-CLEAR-1: the shared clear control, a sibling of the trigger. */}
      {showClear && (
        <SelectClearButton triggerId={triggerId} clearLabel={clearLabel} aria-labelledby={ariaLabelledBy}
          onClear={() => { onChange(''); setOpen(false) }} />
      )}
      {/* PERF (r11 v2): short-circuit here, not inside DropdownPopover — a closed
          picker must never build this option list at all. */}
      {open && (
      <DropdownPopover menuRef={menuRef} id={listId}
        style={{ ...menuShellStyle(rect, openUp, menuWidth, menuMaxHeight, true), overflowY: 'auto' }}>
        {/* Filter box — autofocused so typing narrows immediately, Escape-safe
            (the outside-click/Escape handling above owns closing). */}
        <div style={{ padding: 6, borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)' }}>
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
            aria-label={t('search')} placeholder={t('search')}
            style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', fontSize: 12, borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }} />
        </div>
        {opts.length === 0 && <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{placeholder ?? '—'}</div>}
        {opts.length > 0 && shown.length === 0 && (
          <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('noResults')}</div>
        )}
        {shown.map(o => (
          <button key={o.value} type="button" onClick={() => { if (o.disabled) return; onChange(o.value); setOpen(false) }}
            aria-current={value === o.value} disabled={o.disabled} aria-disabled={o.disabled || undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 12px', textAlign: 'left', fontSize: 12,
              cursor: o.disabled ? 'default' : 'pointer', border: 'none',
              background: value === o.value ? 'var(--color-primary-bg)' : 'none',
              color: o.disabled ? 'var(--text-muted)' : 'var(--text)' }}>
            {o.initials && <Avatar initials={o.initials} size={20} />}
            {o.icon && !o.initials && <span style={{ display: 'flex', flexShrink: 0 }}>{o.icon}</span>}
            <span style={{ flex: 1 }}>{o.label}</span>
            {value === o.value && <Check size={13} style={{ color: 'var(--color-primary-text)', flexShrink: 0 }} />}
          </button>
        ))}
      </DropdownPopover>
      )}
    </div>
  )
}
