/**
 * IconPickerControl — a compact in-row icon picker for lookup editors (Danny
 * 23-07: the icon belongs IN the row next to the colour, not in a separate
 * block). Generic: the host passes the curated `icons` (slug list) and a
 * `resolve(slug) → LucideIcon` — this control never hardcodes a vocabulary.
 */
import { createElement, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'

// Panel component so the focus trap arms only while the popover is OPEN: Escape
// is handled (and stopped) at the popover itself, never by a hosting dialog's trap.
function IconPopoverPanel({ onClose, children }) {
  const panelRef = useFocusTrap(onClose)
  return (
    // Floating popover under its trigger, usable both on plain rows and inside
    // modals — the CSS popover rung mirrors SelectMenu/CreatableSelect.
    <div ref={panelRef} tabIndex={-1} role="menu" style={{ position: 'absolute', zIndex: 'var(--z-popover)', top: 30, left: 0, width: 168,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10,
      boxShadow: 'var(--shadow-float)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
      {children}
    </div>
  )
}

// See the file's top doc above; a generic icon popover, never hardcoding a vocabulary itself.
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

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      {/* Trigger: the row's current icon, tinted in the row's own colour (§4). Uses
          createElement (not a JSX-assigned variable) so a resolved icon component
          never trips react-hooks/static-components — mirrors lib/roleIcons.ts. */}
      <button type="button" onClick={() => setOpen(o => !o)} aria-label={`${t('documentTypes.icon')}: ${label}`}
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- tint derived from this row's own colour prop, not a fixed Button variant
        style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
          borderRadius: 6, cursor: 'pointer', color }}>
        {createElement(resolve(value), { size: 13 })}
      </button>
      {open && (
        <IconPopoverPanel onClose={() => setOpen(false)}>
          {icons.map(name => {
            const active = name === value
            return (
              <button key={name} type="button" role="menuitem" title={name}
                aria-label={`${t('documentTypes.icon')}: ${name}`}
                onClick={() => { onPick(name); setOpen(false) }}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- icon-grid menu-item cell (role="menuitem"), not a Button
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'var(--bg)',
                  border: `1px solid ${active ? 'color-mix(in srgb, var(--color-primary) 45%, transparent)' : 'var(--border)'}`,
                  // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                  borderRadius: 7, cursor: 'pointer', color: active ? 'var(--color-primary-text)' : 'var(--text)' }}>
                {createElement(resolve(name), { size: 15 })}
              </button>
            )
          })}
        </IconPopoverPanel>
      )}
    </div>
  )
}
