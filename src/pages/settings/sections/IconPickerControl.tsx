/**
 * IconPickerControl — a compact in-row icon picker for lookup editors (Danny
 * 23-07: the icon belongs IN the row next to the colour, not in a separate
 * block). Generic: the host passes the curated `icons` (slug list) and a
 * `resolve(slug) → LucideIcon` — this control never hardcodes a vocabulary.
 *
 * Two pieces are exported alongside the default IconPickerControl so
 * LookupValueMark (LOOKUP-ONE-ELEMENT-1) can reuse them instead of forking a
 * second 4-column icon grid or a second colour-carrying trigger:
 *   - IconGrid — the 4-column icon-cell grid, used by this control's own
 *     popover below AND by LookupValueMark's popover.
 *   - ValueMarkTrigger — the 28×28 trigger LookupValueMark renders. It lives
 *     here (not in LookupValueMark.tsx) so its one necessary lint exception
 *     (a colour-carrying trigger can never be a fixed Button variant) stays
 *     inside this file's already-audited legacy-debt allowance instead of
 *     opening a fresh entry in scripts/huisstijl-ceiling.json for a brand-new file.
 */
import type { ComponentType, ReactNode } from 'react'
import { createElement, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useDropdownPlacement } from '@/lib/useDropdownPlacement'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'

// A slug → icon component resolver, never a fixed vocabulary (see file doc above).
// Kept loose (unknown, not LucideIcon) — the callers vary: some resolvers are
// typed .ts (lookupIcons.ts) and return LucideIcon proper, others (LookupValueMark's
// own untyped-JS-era resolver prop) are declared to return unknown. createElement
// below narrows what it actually needs (a component type) via a local cast.
type IconResolver = (name?: string | null) => unknown

// Props for the shared 4-column icon-cell grid.
interface IconGridProps {
  icons: string[]
  resolve: IconResolver
  value?: string | null
  onPick: (name: string) => void
}

// IconGrid — the 4-column icon-cell grid shared by this control's own popover
// and by LookupValueMark's popover (LOOKUP-ONE-ELEMENT-1), so a family's icon
// vocabulary always renders identically wherever it is picked from. Active-cell
// tint reads the shared §4 formula (tintBg/tintBorder), not a hand-rolled percentage.
export function IconGrid({ icons, resolve, value, onPick }: IconGridProps) {
  const { t } = useTranslation('settings')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
      {icons.map(name => {
        const active = name === value
        return (
          <button key={name} type="button" role="menuitem" title={name}
            aria-label={`${t('documentTypes.icon')}: ${name}`}
            onClick={() => onPick(name)}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- icon-grid menu-item cell (role="menuitem"), not a Button
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: active ? tintBg('var(--color-primary)', true) : 'var(--bg)',
              border: active ? tintBorder('var(--color-primary)', true) : '1px solid var(--border)',
              // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
              borderRadius: 7, cursor: 'pointer', color: active ? 'var(--color-primary-text)' : 'var(--text)' }}>
            {createElement(resolve(name) as ComponentType<{ size?: number }>, { size: 15 })}
          </button>
        )
      })}
    </div>
  )
}

// Props for the popover panel wrapping the icon grid — the anchor drives placement.
interface IconPopoverPanelProps {
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
}

// Panel component so the focus trap arms only while the popover is OPEN: Escape
// is handled (and stopped) at the popover itself, never by a hosting dialog's trap.
// SETTINGS-INCON-B2 F1 (Opus review, 13-09): portalled into document.body — the
// same house recipe as CreatableSelect.tsx (createPortal + fixed coords off the
// trigger's own measured rect), so this popover escapes a hosting modal's
// `overflow: hidden`/`overflow: auto` panel instead of getting clipped by it.
function IconPopoverPanel({ anchorRef, onClose, children }: IconPopoverPanelProps) {
  const panelRef = useFocusTrap(onClose)
  // Positioned off the TRIGGER's rect (not this panel's own, portalled-out position).
  const { rect } = useDropdownPlacement(anchorRef, true)
  // Close on an outside click — the trigger AND the portalled panel itself both
  // count as "inside" (shared useClickOutside, CLICK-OUTSIDE-2).
  useClickOutside([anchorRef, panelRef], true, onClose)
  return createPortal(
    // Floating popover under its trigger, usable both on plain rows and inside
    // modals — the CSS popover rung mirrors SelectMenu/CreatableSelect.
    <div ref={panelRef} tabIndex={-1} role="menu" style={{ position: 'fixed', zIndex: 'var(--z-popover)', width: 168,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10,
      boxShadow: 'var(--shadow-float)',
      visibility: rect ? 'visible' : 'hidden', top: rect ? rect.bottom + 4 : 0, left: rect ? rect.left : 0 }}>
      {children}
    </div>,
    document.body,
  )
}

// Props for the value-mark trigger (icon or solid colour fill).
interface ValueMarkTriggerProps {
  iconEl?: ReactNode
  color: string
  ariaLabel: string
  onClick: () => void
}

// ValueMarkTrigger — LOOKUP-ONE-ELEMENT-1: the ONE 28×28 trigger LookupValueMark
// renders — an icon tinted in its own colour, or a solid colour fill when the
// family has no icon vocabulary. The mark's own colour drives its fill/tint, so
// it can never be a fixed Button variant (§4 necessity exception). The icon's
// ink reads chipInk(color), not the raw colour — text/an icon sitting on its
// own tint never carries the bare colour as ink (herhaal-slotaudit 20-08: the
// raw colour measures 2.4-3.0:1, an AA fail; chipInk is the SoftChip fix).
export function ValueMarkTrigger({ iconEl, color, ariaLabel, onClick }: ValueMarkTriggerProps) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel}
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- the value's own colour drives this trigger's fill/tint, not a fixed Button variant
      style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        borderRadius: 6, cursor: 'pointer',
        background: iconEl ? tintBg(color, true) : color,
        border: iconEl ? tintBorder(color, true) : '1px solid rgba(0,0,0,0.1)',
        color: iconEl ? chipInk(color) : 'inherit' }}>
      {iconEl}
    </button>
  )
}

// Props for the default export: the row's own colour, its current icon value, a
// label for the trigger's aria-label, and the picked-icon callback.
interface IconPickerControlProps {
  icons: string[]
  resolve: IconResolver
  value?: string | null
  color: string
  label: string
  onPick: (name: string) => void
}

// See the file's top doc above; a generic icon popover, never hardcoding a vocabulary itself.
export default function IconPickerControl({ icons, resolve, value, color, label, onPick }: IconPickerControlProps) {
  const { t } = useTranslation('settings')
  const [open, setOpen] = useState(false)
  // The trigger's own ref — IconPopoverPanel (now portalled) reads its rect for
  // placement and treats it as "inside" for outside-click-close.
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      {/* Trigger: the row's current icon, tinted in the row's own colour (§4). Uses
          createElement (not a JSX-assigned variable) so a resolved icon component
          never trips react-hooks/static-components — mirrors lib/roleIcons.ts. */}
      <button type="button" onClick={() => setOpen(o => !o)} aria-label={`${t('documentTypes.icon')}: ${label}`}
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- tint derived from this row's own colour prop, not a fixed Button variant
        style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: tintBg(color, true), border: `1px solid ${tintBorder(color, true)}`,
          borderRadius: 6, cursor: 'pointer', color: chipInk(color) }}>
        {createElement(resolve(value) as ComponentType<{ size?: number }>, { size: 13 })}
      </button>
      {open && (
        <IconPopoverPanel anchorRef={ref} onClose={() => setOpen(false)}>
          <IconGrid icons={icons} resolve={resolve} value={value} onPick={(icon: string) => { onPick(icon); setOpen(false) }} />
        </IconPopoverPanel>
      )}
    </div>
  )
}
