import { useTranslation } from 'react-i18next'
import { ListChecks, Activity, Flag, UserCog, Archive, X } from 'lucide-react'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuNode } from '@/components/ui/ActionMenu'
import { BTN_H } from '@/config/buttonMetrics'
import type { TaskLookupItem } from '@/context/TaskLookupsContext'
import type { Id } from '@/types/common'

interface BulkUser { id: Id; name: string }

interface TasksBulkBarProps {
  count: number
  onClear: () => void
  onSetStatus: (statusKey: string) => void
  onSetPriority: (priorityKey: string) => void
  onSetAssignee: (userId: string) => void
  onArchive: () => void
  canArchive?: boolean
  statuses?: TaskLookupItem[]
  priorities?: TaskLookupItem[]
  users?: BulkUser[]
}

/**
 * TasksBulkBar — the selection action bar shown above the table when ≥1 task is
 * checked. A single "Massa-acties" menu (ActionMenu, drill-in) holds every bulk
 * mutation; each action is one config node fed by props, so this stays a thin
 * assembler. Mirrors CandidatesBulkBar. Delete is authorization-gated (canDelete);
 * the backend re-checks.
 */
export default function TasksBulkBar({
  count, onClear, onSetStatus, onSetPriority, onSetAssignee, onArchive, canArchive = false,
  statuses = [], priorities = [], users = [],
}: TasksBulkBarProps) {
  const { t } = useTranslation('tasks')

  // Build the option lists from the lookups/users props.
  const statusOptions   = statuses.map(s => ({ value: s.value, label: s.label, color: s.color }))
  const priorityOptions = priorities.map(p => ({ value: p.value, label: p.label, color: p.color }))
  // Assignee options: "Bureau" (unassign) first, then every user.
  const assigneeOptions = [{ value: '', label: t('bureau') }, ...users.map(u => ({ value: u.id, label: u.name }))]

  // Declarative bulk-action tree; extend with more actions as extra nodes.
  const items: MenuNode[] = [
    { key: 'status', label: t('bulk.changeStatus'), icon: Activity,
      searchPlaceholder: t('bulk.searchStatus'), options: statusOptions, onPick: v => onSetStatus(String(v)) },
    { key: 'priority', label: t('bulk.changePriority'), icon: Flag,
      searchPlaceholder: t('bulk.searchPriority'), options: priorityOptions, onPick: v => onSetPriority(String(v)) },
    { key: 'assignee', label: t('bulk.changeAssignee'), icon: UserCog,
      searchPlaceholder: t('bulk.searchAssignee'), emptyText: t('bulk.noUsers'), options: assigneeOptions, onPick: v => onSetAssignee(String(v)) },
    ...(canArchive ? [{ key: 'archive', label: t('bulk.archive'), icon: Archive, danger: true, onSelect: onArchive }] : []),
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
        {t('bulk.selected', { count })}
      </span>

      {/* Single bulk-mutations menu with drill-in submenus */}
      <ActionMenu label={t('bulk.actions')} icon={ListChecks} items={items} />

      {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
      <button onClick={onClear}
        style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', height: BTN_H, padding: '0 10px', fontSize: 12,
          border: 'none', borderRadius: 7, background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 500 }}>
        <X size={13} /> {t('bulk.deselect')}
      </button>
    </div>
  )
}
