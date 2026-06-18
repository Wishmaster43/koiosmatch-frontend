/**
 * SettingsControls — small shared UI controls reused across settings sections:
 * a colour picker (swatch + popup), a colour badge, and a drag-to-reorder list.
 */
import { useState, useEffect, useRef } from 'react'
import { GripVertical } from 'lucide-react'

const COLOR_PRESETS = [
  'var(--color-danger)','#F97316','var(--color-warning)','#84CC16','var(--color-success)','#14B8A6',
  '#3B8FD4','var(--color-primary)','#8B5CF6','#EC4899','#6B7280','#111827',
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
  return (
    <div ref={ref} style={{ position: 'absolute', zIndex: 100, background: 'white', border: '1px solid #E5E7EB',
                             borderRadius: 10, padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', top: 36, left: 0, width: 192 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {COLOR_PRESETS.map(c => (
          <button key={c} onClick={() => apply(c)}
            style={{ width: 24, height: 24, borderRadius: 6, background: c, border: c === hex ? '2px solid #111827' : '2px solid transparent', cursor: 'pointer' }} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="color" value={hex} onChange={e => apply(e.target.value)}
          style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 6 }} />
        <input value={hex} onChange={e => { setHex(e.target.value); if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) onChange(e.target.value) }}
          style={{ flex: 1, height: 28, padding: '0 8px', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 6, fontFamily: 'monospace', outline: 'none' }} />
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
