import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * IconPickerControl — a compact in-row icon picker for lookup editors (Danny
 * 23-07: the icon belongs IN the row next to the colour, not in a separate
 * block). Generic: the host passes the curated `icons` (slug list) and a
 * `resolve(slug) → LucideIcon` — this control never hardcodes a vocabulary.
 */
export default function IconPickerControl({ icons, resolve, value, color, label, onPick }) {
  const { t } = useTranslation('settings')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close on an outside click while the popover is open.
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const Icon = resolve(value)
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      {/* Trigger: the row's current icon, tinted in the row's own colour (§4). */}
      <button type="button" onClick={() => setOpen(o => !o)} aria-label={`${t('documentTypes.icon')}: ${label}`}
        style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
          borderRadius: 6, cursor: 'pointer', color }}>
        <Icon size={13} />
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', zIndex: 100, top: 30, left: 0, width: 168,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {icons.map(name => {
            const OptionIcon = resolve(name)
            const active = name === value
            return (
              <button key={name} type="button" role="menuitem" title={name}
                aria-label={`${t('documentTypes.icon')}: ${name}`}
                onClick={() => { onPick(name); setOpen(false) }}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'var(--bg)',
                  border: `1px solid ${active ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : 'var(--border)'}`,
                  borderRadius: 7, cursor: 'pointer', color: active ? 'var(--color-primary)' : 'var(--text)' }}>
                <OptionIcon size={15} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
