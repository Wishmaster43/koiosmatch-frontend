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
  /** Short visible text (Danny 05-08, DRAWER-ADD-SHORT-1): in a drawer SUB-TAB the
   * "+ Nieuwe <entiteit>" wording is redundant — the sub-tab bar already names the
   * entity — so the visible label collapses to the shared t('common:new') ("Nieuw").
   * The FULL `label` still becomes the title/aria-label, so a caller's own
   * getByRole('button', { name: fullLabel }) test keeps passing unchanged. Only for
   * drawer SUB-TABS — a full entity PAGE's own "+ Add" button stays spelled out. */
  short?: boolean
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
 *
 * DRAWER-ADD-SHORT-1 (Danny 05-08): the 28-07 "always the full label" rule above is
 * SUPERSEDED for drawer SUB-TABS only — there the visible text may shorten to "Nieuw"
 * via `short` (see that prop). A full entity PAGE's own add button keeps the full
 * label, unchanged. Either way "readable text without hovering" still holds — this
 * never goes icon-only for the primary add action.
 */
export default function DrawerAddButton({ onClick, label, icon: Icon = Plus, disabled, title, iconOnly, short }: DrawerAddButtonProps) {
  const { t } = useTranslation('common')
  // The accessible name: the caller's label when it is plain text, else the shared "add".
  const name = typeof label === 'string' ? label : t('add')
  // Visible text: the short house word when requested, else the caller's own label.
  const visibleText = short ? t('new') : (label ?? t('add'))
  return (
    <button onClick={onClick} disabled={disabled} title={title ?? name} aria-label={name}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: iconOnly ? '0 7px' : '0 10px',
        whiteSpace: 'nowrap', flexShrink: 0, fontSize: 11.5, fontWeight: 500, borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
        color: disabled ? 'var(--text-muted)' : 'var(--button-ink)',
        // PRIMAIR-VLAK-1 (Danny 19-08): solid tenant fill — the tinted add-button
        // read as a different species than the page's primary actions.
        background: disabled ? 'var(--bg)' : 'var(--button-fill)',
        border: disabled ? '1px solid var(--border)' : '1px solid var(--button-border)',
        opacity: disabled ? 0.7 : 1,
      }}>
      <Icon size={12} /> {iconOnly ? null : visibleText}
    </button>
  )
}
