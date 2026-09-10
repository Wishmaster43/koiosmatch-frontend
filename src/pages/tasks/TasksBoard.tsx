/**
 * TasksBoard — kanban view, one column per task STATUS (the lookup, never hardcoded).
 * Presentational: the page owns the data and the LOCAL status mutation (onMove).
 * Mirrors ApplicationsBoard. `onMove` both re-groups locally and persists: the
 * page's chain (useTaskDrawerActions.handleUpdate) resolves the status slug to
 * the real `status_id` the server validates, so this board needs no write path
 * of its own (it briefly had one while that chain was silently no-op'ing).
 */
import type { DragEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Avatar from '@/components/ui/Avatar'
import SoftChip from '@/components/ui/SoftChip'
import { useDateFormat } from '@/lib/datetime'
import { isTaskOverdue, dueDateTime } from './data/mapTask'
import type { Task } from '@/types/task'
import type { Id } from '@/types/common'
import { BoardCardShell, BoardColumnShell, BoardScrollArea, useBoardDrag } from '@/components/ui/board'

export interface BoardColumn { key: string | number; label: string; color: string }
type FormatDate = (v?: string | number | Date | null) => string

// A single draggable task card.
function BoardCard({ task, onDragStart, onClick, selected, formatDate, formatDateTime, bureauLabel }: {
  task: Task; onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void; onClick: (t: Task) => void
  selected: boolean; formatDate: FormatDate; formatDateTime: FormatDate; bureauLabel: ReactNode
}) {
  return (
    <BoardCardShell onDragStart={e => onDragStart(e, task.id)} onClick={() => onClick(task)} selected={selected} ariaLabel={task.title ?? ''}>

      {/* Title + priority dot */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', flex: 1, lineHeight: 1.3 }}>{task.title}</span>
        {task.priorityColor && (
          <span title={task.priorityLabel} style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
            marginTop: 3, background: task.priorityColor }} />
        )}
      </div>

      {/* Type chip + TEAM-1: the internal department the task waits at, same soft
          chip in the lookup's own colour (mirrors the table's own team column). */}
      {(task.typeLabel || task.team) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {task.typeLabel && <SoftChip label={task.typeLabel} color={task.typeColor} />}
          {task.team && <SoftChip label={task.team.name} color={task.team.color} />}
        </div>
      )}

      {/* Linked entity (single-line clamp) */}
      {task.linkLabel && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8,
          display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {task.linkLabel}
        </div>
      )}

      {/* Footer: assignee (or bureau) + due date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {task.assignee
          ? <Avatar initials={task.assignee.initials} size={20} color={task.assignee.color} />
          : <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{bureauLabel}</span>}
        {task.due && (
          <span style={{ fontSize: 11, color: isTaskOverdue(task) ? 'var(--color-danger)' : 'var(--text-muted)',
            fontWeight: isTaskOverdue(task) ? 600 : 400 }}>
            {/* TASK-DUE-TIME-1: show the time alongside the date when the task has one. */}
            {task.dueTime ? formatDateTime(dueDateTime(task.due, task.dueTime)) : formatDate(task.due)}
          </span>
        )}
      </div>
    </BoardCardShell>
  )
}

// Column board with HTML5 drag-and-drop between status columns, plus edge-autoscroll while dragging (native DnD never scrolls the container itself).
export default function TasksBoard({ rows, columns, onMove, onSelect, selectedId }: {
  rows: Task[]; columns: BoardColumn[]; onMove: (id: Id, statusKey: string | number) => void; onSelect: (t: Task) => void; selectedId?: Id | null
}) {
  const { t } = useTranslation('tasks')
  const { formatDate, formatDateTime } = useDateFormat()
  // Drag-and-drop wiring: ref for auto-scroll, handlers for start/over/drop, dragId ref.
  const { boardScrollRef, boardAutoScroll, handleDragStart, handleDragOver, handleDrop } = useBoardDrag<HTMLDivElement, string | number>({ onMove })

  return (
    <BoardScrollArea scrollRef={boardScrollRef} onDragOver={boardAutoScroll}>
      {columns.map(column => {
        const items = rows.filter(r => r.statusKey === column.key)
        return (
          <BoardColumnShell key={column.key} label={column.label} color={column.color} showDot={false}
            onDrop={e => handleDrop(e, column.key)} onDragOver={handleDragOver}
            items={items} emptyText={t('board.empty')}
            renderItem={task => (
              <BoardCard key={task.id} task={task} onDragStart={handleDragStart}
                onClick={onSelect} selected={task.id === selectedId} formatDate={formatDate} formatDateTime={formatDateTime} bureauLabel={t('bureau')} />
            )} />
        )
      })}
    </BoardScrollArea>
  )
}
