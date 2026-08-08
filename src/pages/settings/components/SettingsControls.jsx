/**
 * SettingsControls — small shared UI controls reused across settings sections:
 * a colour picker (swatch + popup), a colour badge, and a drag-to-reorder list.
 */
import { useState, useEffect, useRef } from 'react'
import { GripVertical, Check } from 'lucide-react'
import { COLOR_PRESETS } from '@/lib/colorPresets'
import Toggle from '@/components/ui/Toggle'

function ColorPickerPopup({ color, onChange, onClose }) {
  const [hex, setHex] = useState(color)
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  const apply = (c) => { setHex(c); onChange(c) }
  // Curated soft palette only — no free colour wheel/hex, so labels stay calm and
  // consistent in light + dark across statuses / funnel / candidate types / pools / …
  return (
    <div ref={ref} style={{ position: 'absolute', zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)',
                             borderRadius: 10, padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', top: 36, left: 0, width: 192 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {COLOR_PRESETS.map(c => (
          <button key={c} onClick={() => apply(c)}
            style={{ width: 26, height: 26, borderRadius: 6, background: c, border: c === hex ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer' }} />
        ))}
      </div>
    </div>
  )
}

export function ColorSwatch({ color, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: 28, height: 28, borderRadius: 6, background: color, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer' }} />
      {open && <ColorPickerPopup color={color} onChange={c => { onChange(c) }} onClose={() => setOpen(false)} />}
    </div>
  )
}

// Small pill toggle (used by Roles permissions and notification preferences).
// Thin alias over the shared Toggle (Toggle.tsx, "the ONE toggle-switch
// implementation in the app") — this used to hand-roll its own <button> markup,
// duplicating role=switch/aria-checked/type=button/disabled that Toggle already
// implements (audit finding, 05-08). The 7 call sites (RolesPermissionMatrix,
// CandidateRequiredFieldsSettings, FlatRequiredFieldsToggleList,
// CustomerPhaseRequiredFieldsMatrix, EventCatalog) keep their exact API —
// `checked` + a no-argument `onChange`, plus the HTML `aria-label`/`title`
// attributes some of them pass — so none of them need to change.
export function PermissionToggle({ checked, onChange, 'aria-label': ariaLabel, ...rest }) {
  return <Toggle checked={checked} onChange={() => onChange()} ariaLabel={ariaLabel} {...rest} />
}

export function ColorBadge({ label, color }) {
  const bg = color + '22'
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                   background: bg, color: color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  )
}

// Per-row "Standaard" (is_default) singleton toggle — soft-chip convention (§4):
// tinted primary background/border, never a solid fill. By default the ACTIVE pill
// stays clickable so clicking it CLEARS the default (DEFAULT-UNDO, Danny 04-08:
// "je kan niet undo doen") — same soft-tint spec, stronger tint + weight 600 when
// active; the caller owns the singleton flip/clear PUT (only one row true at a time).
// `undoable={false}` opts a caller BACK into the old one-way ratchet (active pill
// hard-disabled) for the rare backend that rejects clearing the flag — see
// CandidateLookupsSettings.jsx's funnel-types/phases usage for the verified case.
export function DefaultToggle({ active, onClick, busy, activeLabel, inactiveLabel, undoable = true, title }) {
  const disabled = busy || (!undoable && active)
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      title={title ?? (active ? activeLabel : inactiveLabel)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 9px',
        fontSize: 11, fontWeight: active ? 600 : 500, borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
        border: `1px solid color-mix(in srgb, var(--color-primary) ${active ? 45 : 28}%, transparent)`,
        background: `color-mix(in srgb, var(--color-primary) ${active ? 16 : 8}%, transparent)`,
        color: 'var(--color-primary-text)', cursor: disabled ? 'default' : 'pointer',
        opacity: busy ? 0.6 : 1,
      }}>
      {active && <Check size={10} />}
      {active ? activeLabel : inactiveLabel}
    </button>
  )
}

// sortable=false renders the same rows without drag affordances — for lookup
// families whose backend has no /reorder route (SimpleLookupController): a drag
// would PUT a nonexistent endpoint and 404-toast on every drop.
export function DragList({ items, onReorder, renderItem, sortable = true }) {
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)

  const handleDrop = () => {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) { setDragIdx(null); setOverIdx(null); return }
    const next = [...items]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(overIdx, 0, moved)
    onReorder(next)
    setDragIdx(null); setOverIdx(null)
  }

  return (
    <div>
      {items.map((item, i) => (
        <div key={item.id ?? i}
          draggable={sortable}
          onDragStart={sortable ? () => setDragIdx(i) : undefined}
          onDragOver={sortable ? e => { e.preventDefault(); setOverIdx(i) } : undefined}
          onDrop={sortable ? handleDrop : undefined}
          onDragEnd={sortable ? () => { setDragIdx(null); setOverIdx(null) } : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                   // eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this row divider/drag-over tint; kept literal to avoid changing the rendered tone
                   borderBottom: '1px solid #F3F4F6', opacity: dragIdx === i ? 0.4 : 1,
                   // eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this drag-over highlight tint; kept literal to avoid changing the rendered tone
                   background: overIdx === i && dragIdx !== i ? '#F0F9FF' : 'transparent',
                   borderRadius: 6, transition: 'background 0.1s' }}>
          {/* eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this grip-icon grey; kept literal to avoid changing the rendered tone */}
          {sortable && <GripVertical size={14} style={{ color: '#D1D5DB', cursor: 'grab', flexShrink: 0 }} />}
          {renderItem(item, i)}
        </div>
      ))}
    </div>
  )
}
