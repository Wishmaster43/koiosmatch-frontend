import { useTranslation } from 'react-i18next'
import DataTable from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import Avatar from '../../components/ui/Avatar'
import StatusPill from '../../components/ui/StatusPill'
import { useDateFormat } from '../../lib/datetime'
import type { Task } from '../../types/task'
import type { Id } from '../../types/common'

// A task is overdue when its due date is in the past and it isn't in a done status.
const isOverdue = (r: Task): boolean => !!(r.due && !r.statusIsDone && new Date(r.due) < new Date(new Date().toDateString()))

interface TasksTableProps {
  rows: Task[]
  loading?: boolean
  error?: unknown
  selectedId?: Id | null
  onSelect?: (row: Task) => void
  stickyHeader?: boolean
}

/**
 * TasksTable — declares columns only; the shared DataTable owns sorting, selection,
 * hover and the loading/empty states. Rows arrive already decorated (status/type/
 * priority label+colour resolved from the lookup) from TasksPage.
 */
export default function TasksTable({ rows, loading, error, selectedId, onSelect, stickyHeader = false }: TasksTableProps) {
  const { t } = useTranslation('tasks')
  const { formatDate } = useDateFormat()

  const columns: Column<Task>[] = [
    // Title — primary cell.
    { key: 'title', header: t('cols.task'), sortable: true, sortValue: r => r.title,
      render: r => <span style={{ fontWeight: 500, color: 'var(--text)' }}>{r.title}</span> },
    // Activity type — soft pill.
    { key: 'type', header: t('cols.type'), sortable: true, sortValue: r => r.typeLabel,
      render: r => r.typeLabel
        ? <StatusPill label={r.typeLabel} color={r.typeColor} />
        : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    // Status — soft pill (the board column).
    { key: 'status', header: t('cols.status'), sortable: true, sortValue: r => r.statusLabel,
      render: r => r.statusLabel
        ? <StatusPill label={r.statusLabel} color={r.statusColor} />
        : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    // Priority — soft pill.
    { key: 'priority', header: t('cols.priority'), sortable: true, sortValue: r => r.priorityLabel,
      render: r => r.priorityLabel
        ? <StatusPill label={r.priorityLabel} color={r.priorityColor} />
        : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    // Linked entity — first link label, single-line clamp.
    { key: 'links', header: t('cols.links'), cellStyle: { color: 'var(--text-muted)', fontSize: 12 },
      render: r => r.linkLabel
        ? <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 200 }}>{r.linkLabel}</span>
        : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    // Assignee — avatar + name, or "Bureau" when nobody is assigned.
    { key: 'assignee', header: t('cols.assignee'), sortable: true, sortValue: r => r.assignee?.name ?? '',
      render: r => r.assignee ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar initials={r.assignee.initials} size={22} color={r.assignee.color} />
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{r.assignee.name}</span>
        </span>
      ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('bureau')}</span> },
    // Due date — DD-MM-YYYY, red when overdue.
    { key: 'due', header: t('cols.due'), sortable: true, sortValue: r => r.due || '',
      render: r => r.due
        ? <span style={{ fontSize: 12, color: isOverdue(r) ? 'var(--color-danger)' : 'var(--text-muted)', fontWeight: isOverdue(r) ? 600 : 400 }}>{formatDate(r.due)}</span>
        : <span style={{ color: 'var(--text-muted)' }}>—</span> },
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
      stickyHeader={stickyHeader}
    />
  )
}
