/**
 * LookupValueMark — LOOKUP-ONE-ELEMENT-1 (Danny 10-09 23:20, binding): every
 * lookup value is represented by ONE element that carries its colour — an icon
 * drawn in the value's colour, or, when the family has no icon vocabulary, the
 * colour itself — never an icon next to a separate colour dot, never grey.
 * Replaces the row's old pair (a 28×28 ColorSwatch beside a 24×24 tinted
 * IconPickerControl box) plus the coloured ColorBadge label chip: this is the
 * single trigger, and the row's label now renders as plain text (StatusListRow).
 *
 * The trigger (ValueMarkTrigger) and the icon grid (IconGrid) are imported from
 * IconPickerControl.jsx rather than redrawn here — see that file's top doc for
 * why (keeps the one necessary colour-carrying-trigger lint exception inside an
 * already-audited file instead of opening a fresh huisstijl-ceiling entry).
 */
import { createElement, useRef, useState } from 'react'
import type { ComponentType, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useDropdownPlacement } from '@/lib/useDropdownPlacement'
import { ColorPaletteGrid } from '../components/SettingsControls'
import { IconGrid, ValueMarkTrigger } from './IconPickerControl'
import { FALLBACK_SWATCH } from './statusListEditorTypes'

interface LookupValueMarkProps {
  color?: string | null
  icon?: string | null
  icons?: string[] | null
  // Untyped resolve contract (mirrors IconPickerDef in statusListEditorTypes.ts):
  // a slug → icon component, from the .jsx icon-picker machinery.
  resolve?: (name?: string | null) => unknown
  label: string
  withColor: boolean
  onPickColor?: (color: string) => void
  onPickIcon?: (icon: string) => void
}

interface ValueMarkPopoverProps {
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  icons: string[] | null
  resolve?: (name?: string | null) => unknown
  icon?: string | null
  onPickIcon: (icon: string) => void
  withColor: boolean
  color: string
  onPickColor: (color: string) => void
  // Accessible name of the popover (the trigger's own label).
  ariaLabel: string
}

// The stacked popover: the icon grid on top (only when the family has icons),
// the colour palette below it (only when the row is colour-carrying) — either
// pick happens from the one trigger, never a second control.
// SETTINGS-INCON-B2 F1 (Opus review, 13-09): portalled into document.body — a
// lookup row (its trigger) commonly sits inside a scrolling list/table, and an
// absolutely-positioned popover there gets clipped by that scroll container the
// same way a hosting modal's own overflow would clip it. Mirrors the house
// recipe in CreatableSelect.tsx (createPortal + fixed coords off the trigger's
// own measured rect via the shared useDropdownPlacement).
function ValueMarkPopover({ anchorRef, onClose, icons, resolve, icon, onPickIcon, withColor, color, onPickColor, ariaLabel }: ValueMarkPopoverProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  // Positioned off the TRIGGER's rect (not this panel's own, portalled-out position).
  const { rect } = useDropdownPlacement(anchorRef, true)
  // Close on an outside click — the trigger AND the portalled panel itself both
  // count as "inside" (shared useClickOutside, CLICK-OUTSIDE-2).
  useClickOutside([anchorRef, panelRef], true, onClose)
  return createPortal(
    <div ref={panelRef} tabIndex={-1} role={icons && resolve ? 'menu' : 'dialog'} aria-label={ariaLabel} style={{ position: 'fixed', zIndex: 'var(--z-popover)', width: 192,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12,
      boxShadow: 'var(--shadow-float)', display: 'flex', flexDirection: 'column', gap: 10,
      visibility: rect ? 'visible' : 'hidden', top: rect ? rect.bottom + 4 : 0, left: rect ? rect.left : 0 }}>
      {icons && resolve && (
        <IconGrid icons={icons} resolve={resolve} value={icon} onPick={(name: string) => { onPickIcon(name); onClose() }} />
      )}
      {withColor && <ColorPaletteGrid value={color} onPick={onPickColor} />}
    </div>,
    document.body,
  )
}

// One coloured element per lookup value (LOOKUP-ONE-ELEMENT-1): an icon tinted
// in the value's own colour when the family has icons, or the colour fill
// itself when it doesn't — never a separate swatch dot next to a separate icon box.
export default function LookupValueMark({ color, icon, icons, resolve, label, withColor, onPickColor, onPickIcon }: LookupValueMarkProps) {
  const { t } = useTranslation('settings')
  const [open, setOpen] = useState(false)
  // The trigger's own ref — ValueMarkPopover (now portalled) reads its rect for
  // placement and treats it as "inside" for outside-click-close.
  const ref = useRef<HTMLDivElement>(null)

  const hasIcons = Boolean(icons && icons.length && resolve)
  // Colour = the row's own value, never grey/undefined (LOOKUP-ONE-ELEMENT-1).
  const resolvedColor = color ?? FALLBACK_SWATCH
  const iconEl = hasIcons && resolve ? createElement(resolve(icon) as ComponentType<{ size?: number }>, { size: 14 }) : null
  // The icon-tinted face names both icon and colour; the colour-only face names
  // just the colour (§6 a11y — the accessible name matches what the trigger shows).
  const ariaLabel = hasIcons ? t('statusList.valueMark', { label }) : t('statusList.colorMark', { label })

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <ValueMarkTrigger iconEl={iconEl} color={resolvedColor} ariaLabel={ariaLabel} onClick={() => setOpen(o => !o)} />
      {open && (
        <ValueMarkPopover anchorRef={ref} onClose={() => setOpen(false)} ariaLabel={ariaLabel}
          icons={hasIcons ? (icons as string[]) : null} resolve={resolve} icon={icon}
          onPickIcon={onPickIcon ?? (() => {})}
          withColor={withColor} color={resolvedColor} onPickColor={onPickColor ?? (() => {})} />
      )}
    </div>
  )
}
