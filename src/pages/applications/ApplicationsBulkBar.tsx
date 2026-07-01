import { useTranslation } from 'react-i18next'
import { ListChecks, Milestone, Unlink, X } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuNode } from '@/components/ui/ActionMenu'
import type { LookupOption } from '@/types/common'

interface ApplicationsBulkBarProps {
  count: number
  onClear: () => void
  onSetPhase: (phaseKey: string) => void
  onDetach: () => void
  canManage?: boolean
  phases?: LookupOption[]
}

/**
 * ApplicationsBulkBar — selection action bar shown above the table when ≥1
 * application is checked. One "bulk actions" menu (ActionMenu, drill-in): change
 * funnel phase + detach (danger, permission-gated). Thin assembler — options in
 * via props, the mutation runs in the page. Extend by adding a node.
 */
export default function ApplicationsBulkBar({ count, onClear, onSetPhase, onDetach, canManage = false, phases = [] }: ApplicationsBulkBarProps) {
  const { t } = useTranslation('applications')
  // Phase options from the funnel lookup (never hardcoded).
  const phaseOptions = phases.map(p => ({ value: p.value, label: p.label, color: p.color }))

  // Declarative action tree; detach only when the user may manage (server re-checks).
  const items: MenuNode[] = [
    { key: 'phase', label: t('bulk.changePhase'), icon: Milestone,
      searchPlaceholder: t('bulk.searchPhase'), options: phaseOptions, onPick: v => onSetPhase(String(v)) },
    ...(canManage ? [{ key: 'detach', label: t('bulk.detach'), icon: Unlink, danger: true, onSelect: onDetach }] : []),
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{t('bulk.selected', { count })}</span>

      {/* Single bulk-actions menu with drill-in submenus */}
      <ActionMenu label={t('bulk.actions')} icon={ListChecks} items={items} />

      <button onClick={onClear}
        style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', padding: '6px 10px', fontSize: 12,
          border: 'none', borderRadius: 7, background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 500 }}>
        <X size={13} /> {t('bulk.deselect')}
      </button>
    </div>
  )
}
