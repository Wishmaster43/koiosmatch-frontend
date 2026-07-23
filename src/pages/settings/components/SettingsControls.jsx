/**
 * SettingsControls — small shared UI controls reused across settings sections:
 * a colour picker (swatch + popup), a colour badge, and a drag-to-reorder list.
 */
import { useState, useEffect, useRef } from 'react'
import { GripVertical, Check } from 'lucide-react'
import { COLOR_PRESETS } from '@/lib/colorPresets'

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
// Forwards aria-label/title/rest props straight onto the button so callers can
// give it an accessible name (e.g. the permission matrix's "<group> — <action>")
// without a wrapping element — additive, existing callers without these props
// are unaffected.
export function PermissionToggle({ checked, onChange, ...rest }) {
  return (
    <button {...rest} onClick={onChange}
      style={{ width: 32, height: 18, borderRadius: 999, border: 'none', cursor: 'pointer',
               background: checked ? 'var(--color-primary)' : 'var(--border)', position: 'relative',
               transition: 'background 0.15s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: checked ? 16 : 2, width: 14, height: 14,
                    borderRadius: '50%', background: 'white', transition: 'left 0.15s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
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
// tinted primary background/border, never a solid fill. Active = calm filled pill
// (not clickable, it's already the default); inactive = a lighter, clickable pill
// that promotes this row. The caller owns the singleton flip (only one row true).
export function DefaultToggle({ active, onClick, busy, activeLabel, inactiveLabel }) {
  return (
    <button type="button" onClick={onClick} disabled={active || busy}
      title={active ? activeLabel : inactiveLabel}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 9px',
        fontSize: 11, fontWeight: active ? 600 : 500, borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
        border: `1px solid color-mix(in srgb, var(--color-primary) ${active ? 45 : 28}%, transparent)`,
        background: `color-mix(in srgb, var(--color-primary) ${active ? 16 : 8}%, transparent)`,
        color: 'var(--color-primary)', cursor: active || busy ? 'default' : 'pointer',
        opacity: busy ? 0.6 : 1,
      }}>
      {active && <Check size={10} />}
      {active ? activeLabel : inactiveLabel}
    </button>
  )
}

export function DragList({ items, onReorder, renderItem }) {
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
          draggable
          onDragStart={() => setDragIdx(i)}
          onDragOver={e => { e.preventDefault(); setOverIdx(i) }}
          onDrop={handleDrop}
          onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                   // eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this row divider/drag-over tint; kept literal to avoid changing the rendered tone
                   borderBottom: '1px solid #F3F4F6', opacity: dragIdx === i ? 0.4 : 1,
                   // eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this drag-over highlight tint; kept literal to avoid changing the rendered tone
                   background: overIdx === i && dragIdx !== i ? '#F0F9FF' : 'transparent',
                   borderRadius: 6, transition: 'background 0.1s' }}>
          {/* eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this grip-icon grey; kept literal to avoid changing the rendered tone */}
          <GripVertical size={14} style={{ color: '#D1D5DB', cursor: 'grab', flexShrink: 0 }} />
          {renderItem(item, i)}
        </div>
      ))}
    </div>
  )
}
