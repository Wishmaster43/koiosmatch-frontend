import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

interface DrawerAddButtonProps {
  onClick: () => void
  label?: ReactNode
  icon?: ComponentType<{ size?: number }>
  disabled?: boolean
  title?: string
  /** Icon-only rendering for SECONDARY actions in tight toolbars (Danny 03-08: the
   * location-scoped contacts row overflowed). The 28-07 "label must be readable"
   * rule still holds for the primary add button — never pass this on the main
   * "+ …" action; the full label stays the accessible name and hover title. */
  iconOnly?: boolean
}

/**
 * Plus ICON + TEXT label (Danny 28-07: "+ nieuwe taak / + nieuwe afdeling … ETC!!").
 * An icon-only variant was tried and rejected the same day — the label must be readable
 * without hovering.
 *
 * DrawerAddButton — the ONE "+ action" button style for drawer tabs/sub-tabs APP-WIDE
 * (promoted from the candidate drawer — measured from the WorkTab "+ Match" / "+ Solliciteren"
 * buttons — the reference for Danny's consistency sweep, 2026-07). Mirrors §4's
 * QuickViewToggle lesson: one shared component, never a per-section restyle.
 * Reuse this everywhere a tab needs a right-aligned add-trigger.
 */
export default function DrawerAddButton({ onClick, label, icon: Icon = Plus, disabled, title, iconOnly }: DrawerAddButtonProps) {
  const { t } = useTranslation('common')
  // The accessible name: the caller's label when it is plain text, else the shared "add".
  const name = typeof label === 'string' ? label : t('add')
  return (
    <button onClick={onClick} disabled={disabled} title={title ?? name} aria-label={name}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: iconOnly ? '0 7px' : '0 10px',
        whiteSpace: 'nowrap', flexShrink: 0, fontSize: 11.5, fontWeight: 500, borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'var(--text-muted)' : 'var(--color-primary)',
        background: disabled ? 'var(--bg)' : 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
        border: `1px solid ${disabled ? 'var(--border)' : 'color-mix(in srgb, var(--color-primary) 30%, transparent)'}`,
        opacity: disabled ? 0.7 : 1,
      }}>
      <Icon size={12} /> {iconOnly ? null : (label ?? t('add'))}
    </button>
  )
}
