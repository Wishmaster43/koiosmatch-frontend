import { useTranslation } from 'react-i18next'
import { ListChecks, Link2, Building2, Layers, X } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuNode } from '@/components/ui/ActionMenu'

interface MatchesBulkBarProps {
  count: number
  onClear: () => void
  onCoupleHelloFlex: () => void
  onCoupleShiftManager: () => void
  // Coupling is authorization-gated in the UI; the backend re-checks (§3B, §7).
  canCouple?: boolean
}

/**
 * MatchesBulkBar — selection action bar shown above the table when ≥1 match is
 * checked. A match is read-only (§3B), so the only bulk operations are coupling
 * the selection to an external backoffice (HelloFlex / ShiftManager), gated on
 * permission. A thin assembler over the shared ActionMenu — extend by adding a
 * node, never fork the bar.
 */
export default function MatchesBulkBar({
  count, onClear, onCoupleHelloFlex, onCoupleShiftManager, canCouple = false,
}: MatchesBulkBarProps) {
  const { t } = useTranslation('matches')

  // Declarative bulk-action tree; coupling drills into the two backoffice targets.
  const items: MenuNode[] = canCouple ? [
    { key: 'couple', label: t('bulk.couple'), icon: Link2, items: [
      { key: 'helloflex',    label: t('bulk.target.helloflex'),    icon: Building2, onSelect: onCoupleHelloFlex },
      { key: 'shiftmanager', label: t('bulk.target.shiftmanager'), icon: Layers,    onSelect: onCoupleShiftManager },
    ] },
  ] : []

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>{t('bulk.selected', { count })}</span>

      {items.length > 0
        ? <ActionMenu label={t('bulk.actions')} icon={ListChecks} items={items} />
        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('bulk.noPermission')}</span>}

      <button onClick={onClear}
        style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', padding: '6px 10px', fontSize: 12,
          border: 'none', borderRadius: 7, background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 500 }}>
        <X size={13} /> {t('bulk.deselect')}
      </button>
    </div>
  )
}
