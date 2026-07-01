import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import type { ReactNode } from 'react'
import Avatar from '@/components/ui/Avatar'
import SoftChip from '@/components/ui/SoftChip'
import { useDateFormat } from '@/lib/datetime'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import type { Task } from '@/types/task'
import type { Id } from '@/types/common'

// A task is overdue when its due date is in the past and it isn't in a done status.
const isOverdue = (r: Task): boolean => !!(r.due && !r.statusIsDone && new Date(r.due) < new Date(new Date().toDateString()))

const dash = <span style={{ color: 'var(--text-muted)' }}>—</span>

interface TasksTableProps {
  rows: Task[]
  loading?: boolean
  error?: unknown
  selectedId?: Id | null
  onSelect?: (row: Task) => void
  selectable?: boolean
  selectedIds?: Set<Id>
  onToggleRow?: (id: Id) => void
  onToggleAll?: (ids: Id[], allSelected: boolean) => void
  stickyHeader?: boolean
  scrollParentRef?: RefObject<HTMLElement | null>
}

/**
 * TasksTable — declares columns only; the shared DataTable owns sorting, selection,
 * hover and the loading/empty states. Rows arrive already decorated (status/type/
 * priority label+colour resolved from the lookup) from TasksPage. Coloured chips use
 * the §3A soft-chip convention (SoftChip), matching the candidate table.
 */
export default function TasksTable({
  rows, loading, error, selectedId, onSelect,
  selectable, selectedIds, onToggleRow, onToggleAll, stickyHeader = false, scrollParentRef,
}: TasksTableProps) {
  const { t } = useTranslation('tasks')
  const { formatDate } = useDateFormat()
  // Tenant display settings (Settings → Tasks → Table display). Coloured chips ON by
  // default; off = plain text. One flag per column.
  const settings = useAllSettings()
  const colorStatus   = getBoolSetting(settings, 'task_table_color_status', true)
  const colorPriority = getBoolSetting(settings, 'task_table_color_priority', true)
  const colorType     = getBoolSetting(settings, 'task_table_color_type', true)
  // Coloured chip vs. plain text, driven by the per-column flag.
  const chip = (label: string, color: string | null, on: boolean, dot = false): ReactNode =>
    !label ? dash : on ? <SoftChip label={label} color={color} dot={dot} /> : <span style={{ color: 'var(--text)', fontSize: 12 }}>{label}</span>

  const columns: Column<Task>[] = [
    // Title — primary cell, pinned during horizontal scroll.
    { key: 'title', header: t('cols.task'), sortable: true, sortValue: r => r.title, sticky: true, width: 220,
      render: r => <span style={{ fontWeight: 500, color: 'var(--text)' }}>{r.title}</span> },
    // Activity type — soft chip (or plain text per tenant setting).
    { key: 'type', header: t('cols.type'), sortable: true, sortValue: r => r.typeLabel,
      render: r => chip(r.typeLabel, r.typeColor, colorType) },
    // Status — soft chip (the board column).
    { key: 'status', header: t('cols.status'), sortable: true, sortValue: r => r.statusLabel,
      render: r => chip(r.statusLabel, r.statusColor, colorStatus) },
    // Priority — soft chip with a leading dot.
    { key: 'priority', header: t('cols.priority'), sortable: true, sortValue: r => r.priorityLabel,
      render: r => chip(r.priorityLabel, r.priorityColor, colorPriority, true) },
    // Linked entity — first link label, single-line clamp.
    { key: 'links', header: t('cols.links'), cellStyle: { color: 'var(--text-muted)', fontSize: 12 },
      render: r => r.linkLabel
        ? <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 200 }}>{r.linkLabel}</span>
        : dash },
    // Assignee — avatar + name, or "Bureau" when nobody is assigned.
    { key: 'assignee', header: t('cols.assignee'), sortable: true, sortValue: r => r.assignee?.name ?? '',
      render: r => r.assignee ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar initials={r.assignee.initials} size={22} color={r.assignee.color} soft />
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{r.assignee.name}</span>
        </span>
      ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('bureau')}</span> },
    // Due date — DD-MM-YYYY, red when overdue.
    { key: 'due', header: t('cols.due'), sortable: true, sortValue: r => r.due || '',
      render: r => r.due
        ? <span style={{ fontSize: 12, color: isOverdue(r) ? 'var(--color-danger)' : 'var(--text-muted)', fontWeight: isOverdue(r) ? 600 : 400 }}>{formatDate(r.due)}</span>
        : dash },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      loading={loading}
      loadingText={t('loading')}
      emptyText={error ? t('error') : t('empty')}
      onRowClick={onSelect}
      selectedId={selectedId}
      selectable={selectable}
      selectedIds={selectedIds}
      onToggleRow={onToggleRow}
      onToggleAll={onToggleAll}
      stickyHeader={stickyHeader}
      scrollParentRef={scrollParentRef}
      defaultSort={{ key: 'due', dir: 'asc' }}
    />
  )
}
