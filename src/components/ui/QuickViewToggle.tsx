/**
 * QuickViewToggle — the ONE shared quick-view toggle button for every entity list
 * (Blacklist / Archived / status / phase quick-views). It exists so these toggles can
 * never drift per page again (they used to be hand-rolled 5 different ways).
 *
 * §4 soft-chip/toggle convention (identical on candidates · applications · vacancies ·
 * matches · opportunities · tasks · outreach · customers):
 *   - tinted in its OWN semantic colour via color-mix — never a solid fill;
 *   - INACTIVE still carries its colour (subtle 8% tint, not grey);
 *   - ACTIVE = stronger 16% tint + fontWeight 600.
 * The label is a prop so each page passes its own i18n string (no strings live here).
 */
import type { ComponentType } from 'react'

interface QuickViewToggleProps {
  active: boolean
  onToggle: () => void
  label: string
  // Semantic colour token (CSS var or hex). Defaults to the primary accent.
  color?: string
  // Optional leading icon (lucide), mirrors the lucide size contract.
  icon?: ComponentType<{ size?: number }>
  // Accessible title/tooltip; falls back to the label.
  title?: string
  // Footprint (Danny 24-07, candidate Taken sub-tab): 'default' is the page-toolbar
  // size used everywhere else (§4 spacing spec) — never regress that. 'compact'
  // matches DrawerAddButton exactly (height 26, fontSize 11.5, padding 0 10px,
  // borderRadius 6) for a drawer sub-tab toolbar sitting next to one; the soft-tint
  // colouring is identical in both sizes.
  size?: 'default' | 'compact'
}

export default function QuickViewToggle({ active, onToggle, label, color = 'var(--color-primary)', icon: Icon, title, size = 'default' }: QuickViewToggleProps) {
  const compact = size === 'compact'
  return (
    <button type="button" onClick={onToggle} title={title ?? label} aria-pressed={active}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        ...(compact ? { height: 26, padding: '0 10px' } : { padding: '6px 12px' }),
        fontSize: compact ? 11.5 : 12,
        fontWeight: active ? 600 : 500, borderRadius: compact ? 6 : 8, cursor: 'pointer', color,
        background: `color-mix(in srgb, ${color} ${active ? 16 : 8}%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} ${active ? 50 : 28}%, transparent)`,
      }}>
      {Icon && <Icon size={13} />}
      {label}
    </button>
  )
}
