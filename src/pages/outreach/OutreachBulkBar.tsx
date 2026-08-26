/**
 * OutreachBulkBar — the selection action bar shown above the table when ≥1
 * bellijst is checked. A single "Massa-acties" menu (ActionMenu, drill-in) holds
 * the bulk mutations; each action is one config node fed by props. Mirrors
 * TasksBulkBar / CandidatesBulkBar. Archive is authorization-gated (canArchive);
 * the backend re-checks.
 */
import { useTranslation } from 'react-i18next'
import { ListChecks, Activity, Archive } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuNode } from '@/components/ui/ActionMenu'
import BulkBarShell from '@/components/ui/BulkBarShell'

interface StatusOption { value: string; label: string; color: string }

interface Props {
  count: number
  onClear: () => void
  onSetStatus: (status: string) => void
  onArchive: () => void
  canArchive?: boolean
  statuses: StatusOption[]
}

// Thin assembler (see the module doc above): builds the ActionMenu config tree from props, mirroring TasksBulkBar/CandidatesBulkBar.
export default function OutreachBulkBar({ count, onClear, onSetStatus, onArchive, canArchive = false, statuses }: Props) {
  const { t } = useTranslation('outreach')

  // Declarative bulk-action tree; extend with more actions as extra nodes.
  const items: MenuNode[] = [
    { key: 'status', label: t('bulk.changeStatus'), icon: Activity,
      searchPlaceholder: t('bulk.searchStatus'), options: statuses, onPick: (v) => onSetStatus(String(v)) },
    ...(canArchive ? [{ key: 'archive', label: t('bulk.archive'), icon: Archive, danger: true, onSelect: onArchive } as MenuNode] : []),
  ]

  return (
    <BulkBarShell label={t('bulk.selected', { count })} onClear={onClear} clearLabel={t('bulk.deselect')}>
      <ActionMenu label={t('bulk.actions')} icon={ListChecks} items={items} />
    </BulkBarShell>
  )
}
