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
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import Avatar from './Avatar'
import { useDropdownPlacement, DROPDOWN_PORTAL_ATTR } from '@/lib/useDropdownPlacement'

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
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // The portalled menu lives outside `ref`'s subtree — it must ALSO count as
  // "inside" for the outside-click check, or picking an option self-closes first.
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // PORTAL (S24a class fix, 13-08): the menu used to be position:absolute inside
  // the tree, so ANY overflow ancestor (FloatingPanel scroll body, drawer tab)
  // clipped it at its own box. Same cure as CreatableSelect: portal into
  // document.body + fixed positioning off the shared flip/clamp hook.
  const { openUp, maxHeight: menuMaxHeight, rect } = useDropdownPlacement(ref, open)

  // Close on outside click or Escape — both listeners only exist while open, so
  // a CLOSED menu never swallows an Escape meant for an ancestor (e.g. a
  // wrapping modal's own close-on-Escape).
  //
  // The Escape listener is CAPTURE-phase, deliberately. useFocusTrap closes its
  // modal from a bubble-phase listener on the panel node, which sits closer to
  // the key's target than this document-level one — so with both bubbling, the
  // trap won, called stopPropagation, and this menu never even heard the key:
  // Escape inside an open dropdown closed the whole modal while leaving the
  // dropdown standing (PlanIntakeModal is exactly that shape). Capture at the
  // document runs before any bubble handler, so the innermost open thing closes
  // first — which is what Escape means. stopPropagation keeps the same key from
  // also reaching the modal; a second press, with no menu open, closes that.
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey, true)
    }
  }, [open])

  // Restore focus to the trigger whenever the menu transitions open → closed
  // (pick / Escape / outside click) — never on unmount, since that transition
  // never runs this effect. Skipped if some OTHER element already claimed focus
  // (e.g. the outside click landed on a different picker's own trigger) so this
  // never yanks focus away from what the user just interacted with.
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (wasOpenRef.current && !open && (document.activeElement === document.body || document.activeElement == null)) {
      triggerRef.current?.focus()
    }
    wasOpenRef.current = open
  }, [open])

  const opts: SelectOption[] = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  const current = opts.find(o => o.value === value)
  // SEARCHABLE-ALWAYS (Danny 08-08, CLAUDE.md §4: "zoekbare dropdowns overal waar
  // we een dropdown hebben"): every menu filters, including the short ones — so a
  // picker feels the same wherever you meet it. Filtering happens here rather
  // than at 40+ call sites; the trigger, value contract and onChange are
  // untouched, so no consumer changes.
  const [query, setQuery] = useState('')
  const shown = query.trim()
    ? opts.filter(o => String(o.label ?? '').toLowerCase().includes(query.trim().toLowerCase()))
    : opts
  // A fresh open always starts unfiltered — a stale query would hide options.
  useEffect(() => { if (!open) setQuery('') }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Same disclosure semantics as CreatableSelect — one picker convention, so a
          screen reader describes both identically (§6). */}
      {/* HUISSTIJL-1: ONE trigger recipe shared with CreatableSelect (was var(--bg)/r7
          here vs var(--surface)/r6 there) — background var(--surface), border
          1px solid var(--border), radius 6, padding '6px 10px'. */}
      <button ref={triggerRef} onClick={() => setOpen(o => !o)}
        id={triggerId} aria-labelledby={labelledBy}
        aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? listId : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', width: '100%',
          border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer' , ...style }}>
        {leading}
        {current?.initials && <Avatar initials={current.initials} size={18} />}
        {current?.icon && !current.initials && <span style={{ display: 'flex', flexShrink: 0 }}>{current.icon}</span>}
        <span style={{ fontSize: (style as { fontSize?: number } | undefined)?.fontSize ?? 12, flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis', color: current ? 'var(--text)' : 'var(--text-muted)' }}>
          {current?.label ?? placeholder ?? '-'}
        </span>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>
      {open && createPortal(
        <div id={listId} ref={menuRef} {...{ [DROPDOWN_PORTAL_ATTR]: '' }}
          // HUISSTIJL-1: portalled dropdown menu — z-popover ladder tier, shadow-float role.
          style={{ position: 'fixed', zIndex: 'var(--z-popover)', minWidth: menuWidth,
          // Hidden until the first measurement lands — never painted at (0,0).
          visibility: rect ? 'visible' : 'hidden',
          left: rect ? rect.left : 0,
          ...(rect
            ? (openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 })
            : {}),
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: 'var(--shadow-float)', overflow: 'hidden', maxHeight: menuMaxHeight, overflowY: 'auto' }}>
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
            <button key={o.value} onClick={() => { if (o.disabled) return; onChange(o.value); setOpen(false) }}
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
        </div>,
        document.body,
      )}
    </div>
  )
}
