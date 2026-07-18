import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2 } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import type { ReactNode } from 'react'
import Avatar from '@/components/ui/Avatar'
import EntityNameCell from '@/components/ui/EntityNameCell'
import SoftChip from '@/components/ui/SoftChip'
import { useDateFormat } from '@/lib/datetime'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import { isTaskOverdue, dueDateTime } from './data/mapTask'
import type { Task } from '@/types/task'
import type { Id } from '@/types/common'

const dash = <span style={{ color: 'var(--text-muted)' }}>—</span>
// Neutral grey fallback (§3A owner-cell convention) when the assignee has no colour.
const NEUTRAL_AVATAR = '#9CA3AF'
// Single-line title truncation (never wrap to 2 lines) — task titles can run long.
const titleEllipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, display: 'block' as const, maxWidth: 250 }
// "Bureau" (no assignee) icon bubble — same 22px footprint as the person Avatar, so
// the row never jumps between an avatar-shaped and a bare-text look (Danny 2026-07-14:
// the tasks resource has NO location/branch on the list row yet — BE gap, see below).
const bureauBubble = { width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, background: 'color-mix(in srgb, var(--text-muted) 12%, transparent)',
  border: '1px solid color-mix(in srgb, var(--text-muted) 40%, transparent)' }

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
  const { formatDate, formatDateTime } = useDateFormat()
  // Tenant display settings (Settings → Tasks → Table display). Coloured chips ON by
  // default; off = plain text. One flag per column.
  const settings = useAllSettings()
  const colorStatus   = getBoolSetting(settings, 'task_table_color_status', true)
  const colorPriority = getBoolSetting(settings, 'task_table_color_priority', true)
  const colorType     = getBoolSetting(settings, 'task_table_color_type', true)
  const colorAssignee = getBoolSetting(settings, 'task_table_color_assignee', true)
  // Coloured chip vs. plain text, driven by the per-column flag. `round` — the
  // status axis reads as a round pill; type/priority stay square (Danny 2026-07-14).
  const chip = (label: string, color: string | null, on: boolean, dot = false, round = false): ReactNode =>
    !label ? dash : on ? <SoftChip label={label} color={color} dot={dot} round={round} /> : <span style={{ color: 'var(--text)', fontSize: 12 }}>{label}</span>

  // Column order mirrors the candidates blueprint (§3A): identity → status/qualification
  // → link → dates → assignee LAST (Danny 2026-07-14; due-asc default sort is a
  // deliberate exception — tasks stay sorted by urgency, not recency).
  const columns: Column<Task>[] = [
    // Title — primary cell, pinned during horizontal scroll.
    { key: 'title', header: t('cols.task'), sortable: true, sortValue: r => r.title, sticky: true, width: 300, nowrap: true,
      render: r => <span style={{ fontWeight: 500, color: 'var(--text)', ...titleEllipsis }} title={r.title}>{r.title}</span> },
    // Activity type — soft chip (or plain text per tenant setting).
    { key: 'type', header: t('cols.type'), sortable: true, sortValue: r => r.typeLabel,
      render: r => chip(r.typeLabel, r.typeColor, colorType) },
    // Status — round soft chip (the board column).
    { key: 'status', header: t('cols.status'), sortable: true, sortValue: r => r.statusLabel,
      render: r => chip(r.statusLabel, r.statusColor, colorStatus, false, true) },
    // Priority — soft chip with a leading dot.
    { key: 'priority', header: t('cols.priority'), sortable: true, sortValue: r => r.priorityLabel,
      render: r => chip(r.priorityLabel, r.priorityColor, colorPriority, true) },
    // Linked entity — soft avatar + first link's label (AVATAR-CHIP-1: same chip as
    // the candidate identity column), "+N" when a task is linked to several entities.
    { key: 'links', header: t('cols.links'),
      render: r => r.links.length === 0
        ? dash
        : <EntityNameCell name={r.links[0].label} extra={r.links.length > 1 ? r.links.length - 1 : undefined} /> },
    // Due date — DD-MM-YYYY, red when overdue; DD-MM-YYYY HH:mm when a due_time is
    // set (TASK-DUE-TIME-1) — date-only tasks keep the plain date, never fabricated.
    { key: 'due', header: t('cols.due'), sortable: true, sortValue: r => r.due || '',
      render: r => r.due
        ? <span style={{ fontSize: 12, color: isTaskOverdue(r) ? 'var(--color-danger)' : 'var(--text-muted)', fontWeight: isTaskOverdue(r) ? 600 : 400 }}>
            {r.dueTime ? formatDateTime(dueDateTime(r.due, r.dueTime)) : formatDate(r.due)}
          </span>
        : dash },
    { key: 'createdAt', header: t('cols.created'), nowrap: true, sortable: true, sortValue: r => r.createdAt || '',
      cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, render: r => formatDate(r.createdAt) },
    // Assignee — avatar + name (neutral grey fallback when uncoloured), or a
    // building-icon bubble + "Bureau" when nobody is assigned (same avatar-shaped
    // footprint either way — BE gap: the task resource carries no branch/location
    // on the list row yet, so this can't show the vestiging until that ships).
    // LAST column (§3A convention).
    { key: 'assignee', header: t('cols.assignee'), sortable: true, sortValue: r => r.assignee?.name ?? '',
      render: r => r.assignee ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar initials={r.assignee.initials} size={22} color={colorAssignee ? (r.assignee.color || NEUTRAL_AVATAR) : NEUTRAL_AVATAR} soft />
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{r.assignee.name}</span>
        </span>
      ) : (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={bureauBubble}><Building2 size={12} style={{ color: 'var(--text-muted)' }} /></span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('bureau')}</span>
        </span>
      ) },
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
