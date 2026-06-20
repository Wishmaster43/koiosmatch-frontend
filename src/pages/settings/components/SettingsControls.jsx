/**
 * SettingsControls — small shared UI controls reused across settings sections:
 * a colour picker (swatch + popup), a colour badge, and a drag-to-reorder list.
 */
import { useState, useEffect, useRef } from 'react'
import { GripVertical } from 'lucide-react'

// Soft, muted mid-tones — calm in light mode and still readable on dark surfaces
// (used everywhere colours are configured: statuses, phases, vacancy, pools, …).
const COLOR_PRESETS = [
  '#64748B', '#94A3B8', '#6E8FD6', '#8C86D9', '#A98AD1', '#C98BBA',
  '#D98A8A', '#B96B6B', '#DDA071', '#C9AC64', '#79B58E', '#5FB0AC', '#6FA8C4',
]

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
    <div ref={ref} style={{ position: 'absolute', zIndex: 100, background: 'white', border: '1px solid #E5E7EB',
                             borderRadius: 10, padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', top: 36, left: 0, width: 192 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {COLOR_PRESETS.map(c => (
          <button key={c} onClick={() => apply(c)}
            style={{ width: 26, height: 26, borderRadius: 6, background: c, border: c === hex ? '2px solid #111827' : '2px solid transparent', cursor: 'pointer' }} />
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
export function PermissionToggle({ checked, onChange }) {
  return (
    <button onClick={onChange}
      style={{ width: 32, height: 18, borderRadius: 999, border: 'none', cursor: 'pointer',
               background: checked ? 'var(--color-primary)' : '#E5E7EB', position: 'relative',
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
                   borderBottom: '1px solid #F3F4F6', opacity: dragIdx === i ? 0.4 : 1,
                   background: overIdx === i && dragIdx !== i ? '#F0F9FF' : 'transparent',
                   borderRadius: 6, transition: 'background 0.1s' }}>
          <GripVertical size={14} style={{ color: '#D1D5DB', cursor: 'grab', flexShrink: 0 }} />
          {renderItem(item, i)}
        </div>
      ))}
    </div>
  )
}
