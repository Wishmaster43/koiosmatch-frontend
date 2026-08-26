/**
 * OutreachBulkBar — the selection action bar shown above the table when ≥1
 * bellijst is checked. A single "Massa-acties" menu (ActionMenu, drill-in) holds
 * the bulk mutations; each action is one config node fed by props. Mirrors
 * TasksBulkBar / CandidatesBulkBar. Archive is authorization-gated (canArchive);
 * the backend re-checks.
 */
import { useTranslation } from 'react-i18next'
import { ListChecks, Activity, Archive, X } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuNode } from '@/components/ui/ActionMenu'
import Button from '@/components/ui/Button'
import { SectionTitle } from '@/components/ui/typography'

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      {/* colour override: this bar sits on a tinted accent background */}
      <SectionTitle as="span" style={{ color: 'var(--color-primary-text)' }}>{t('bulk.selected', { count })}</SectionTitle>
      <ActionMenu label={t('bulk.actions')} icon={ListChecks} items={items} />
      {/* Deselect: ghost keeps its identity except ink, which stays the accent
          text colour (this bar sits on a tinted accent background). */}
      <Button variant="ghostAccent" onClick={onClear} style={{ gap: 5, marginLeft: 'auto' }}>
        <X size={13} /> {t('bulk.deselect')}
      </Button>
    </div>
  )
}
