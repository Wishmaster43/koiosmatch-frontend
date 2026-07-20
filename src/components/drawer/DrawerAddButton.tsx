import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

interface DrawerAddButtonProps {
  onClick: () => void
  label?: ReactNode
  icon?: ComponentType<{ size?: number }>
  disabled?: boolean
  title?: string
}

/**
 * DrawerAddButton — the ONE "+ action" button style for drawer tabs/sub-tabs APP-WIDE
 * (promoted from the candidate drawer — measured from the WorkTab "+ Match" / "+ Solliciteren"
 * buttons — the reference for Danny's consistency sweep, 2026-07). Mirrors §4's
 * QuickViewToggle lesson: one shared component, never a per-section restyle.
 * Reuse this everywhere a tab needs a right-aligned add-trigger.
 */
export default function DrawerAddButton({ onClick, label, icon: Icon = Plus, disabled, title }: DrawerAddButtonProps) {
  const { t } = useTranslation('common')
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px',
        fontSize: 11.5, fontWeight: 500, borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'var(--text-muted)' : 'var(--color-primary)',
        background: disabled ? 'var(--bg)' : 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
        border: `1px solid ${disabled ? 'var(--border)' : 'color-mix(in srgb, var(--color-primary) 30%, transparent)'}`,
        opacity: disabled ? 0.7 : 1,
      }}>
      <Icon size={12} /> {label ?? t('add')}
    </button>
  )
}
