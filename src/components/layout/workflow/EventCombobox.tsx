/**
 * EventCombobox — the event-trigger picker (TRIGGER-POPUP-2, Danny 23-07).
 * Single-select with a filter input: the catalogue holds every dispatched
 * domain event, so the picker must scale beyond a plain <select>.
 *
 * Its own file because it is a self-contained control with three props and its
 * own open/search state — none of which the schedule modal around it cares about.
 *
 * ESCAPE BUG FIX (historical): this control lives inside `useFocusTrap`'s panel,
 * which used to attach a NATIVE `keydown` listener directly on the dialog DOM
 * node to close the whole modal on Escape. That node sits BETWEEN this input and
 * React's root event delegation, so during the native bubble phase it always
 * fired before this component's own (bubble-phase) `onKeyDown` ever got a chance —
 * Escape here used to discard the whole unsaved trigger config (verified with a
 * spike test: a plain bubble `onKeyDown` never ran before the trap's `onClose`).
 * Portalling this control (as `CreatableSelect` does) would mean restructuring
 * its single always-mounted input into a trigger+portal shape (breaking the
 * existing tests and drifting from the sibling `MultiSelectField`'s identical
 * shape), so instead this uses `useEscapeLayer`: its window listener runs in the
 * CAPTURE phase, which reaches window before the trap's node-level listener even
 * starts, and `stopImmediatePropagation` there stops the event before it ever
 * reaches the trap, closing only this popover. `useFocusTrap`/`SelectMenu` are
 * on the same layered stack today (TRIAGE-3.3), so this no longer needs to route
 * around a document-level listener there — it is kept on `useEscapeLayer` because
 * that IS the current, correct mechanism for a non-portalled popover like this one.
 */
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, ChevronDown, Check } from 'lucide-react'
import { WORKFLOW_EVENT_KEYS, eventKeyToI18nKey } from './eventCatalog'
import { Mono, bodyTextStyle } from '@/components/ui/typography'
import { useEscapeLayer } from '@/hooks/useEscapeLayer'

// Searchable dropdown over the workflow event catalogue; see the module doc
// comment above for why its Escape closes via the window-capture escape layer.
export function EventCombobox({ value, onChange, label }: {
  value: string; onChange: (key: string) => void; label: string
}) {
  const { t } = useTranslation('workflows')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  const labelFor = (key: string) => t(`triggers.events.${eventKeyToI18nKey(key)}`)
  const filtered = WORKFLOW_EVENT_KEYS.filter(key =>
    !search || labelFor(key).toLowerCase().includes(search.toLowerCase()) || key.includes(search.toLowerCase()))

  // Escape layer: closes this popover before the surrounding focus-trapped modal ever sees the key (one-stage).
  useEscapeLayer(open, () => setOpen(false))

  return (
    <div ref={boxRef} style={{ position: 'relative' }}
      onBlur={e => { if (!boxRef.current?.contains(e.relatedTarget as Node)) setOpen(false) }}>
      {/* Control: the selected event, or the live filter while open. */}
      <div onClick={() => setOpen(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8,
                 border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'text' }}>
        <Search size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <input value={open ? search : labelFor(value)} aria-label={label}
          placeholder={labelFor(value)}
          onFocus={() => { setOpen(true); setSearch('') }}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', ...bodyTextStyle }} />
        <ChevronDown size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
      </div>

      {/* Dropdown: every catalogued event, filtered as you type. */}
      {open && (
        // HUISSTIJL-1: dropdown listbox — z-popover ladder tier, shadow-float role.
        <div role="listbox" aria-label={label}
          style={{ position: 'absolute', zIndex: 'var(--z-popover)', top: '100%', left: 0, right: 0, marginTop: 4,
                   maxHeight: 260, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border)',
                   background: 'var(--surface)', boxShadow: 'var(--shadow-float)' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
              {t('fields.multiselectNoResults', { defaultValue: 'Geen resultaten.' })}
            </div>
          ) : filtered.map(key => {
            const active = key === value
            return (
              <button key={key} type="button" role="option" aria-selected={active} data-event-key={key}
                onMouseDown={e => e.preventDefault() /* keep focus so blur doesn't close first */}
                onClick={() => { onChange(key); setOpen(false); setSearch('') }}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- listbox OPTION row: selected-list-row idiom (§4 PRIMAIR-VLAK-1, selected = TINT, never the solid fill), a face Button deliberately does not model
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                         padding: '9px 12px', border: 'none', cursor: 'pointer', fontSize: 13,
                         background: active ? 'var(--color-primary-bg)' : 'transparent',
                         // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                         color: active ? 'var(--color-primary-text)' : 'var(--text)' }}>
                <span style={{ width: 14, flexShrink: 0, display: 'flex' }}>{active && <Check size={13} />}</span>
                <span style={{ flex: 1 }}>{labelFor(key)}</span>
                <Mono style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{key}</Mono>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
