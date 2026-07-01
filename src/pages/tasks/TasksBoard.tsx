import { useRef } from 'react'
import type { DragEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Avatar from '@/components/ui/Avatar'
import StatusPill from '@/components/ui/StatusPill'
import { useDateFormat } from '@/lib/datetime'
import type { Task } from '@/types/task'
import type { Id } from '@/types/common'

export interface BoardColumn { key: string | number; label: string; color: string }
type FormatDate = (v?: string | number | Date | null) => string

// A task is overdue when its due date is in the past and it isn't in a done status.
const isOverdue = (t: Task): boolean => !!(t.due && !t.statusIsDone && new Date(t.due) < new Date(new Date().toDateString()))

// A single draggable task card.
function BoardCard({ task, onDragStart, onClick, selected, formatDate, bureauLabel }: {
  task: Task; onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void; onClick: (t: Task) => void
  selected: boolean; formatDate: FormatDate; bureauLabel: ReactNode
}) {
  return (
    <div draggable onDragStart={e => onDragStart(e, task.id)} onClick={() => onClick(task)}
      style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', marginBottom: 8,
        cursor: 'grab', userSelect: 'none',
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--border)'}` }}>

      {/* Title + priority dot */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', flex: 1, lineHeight: 1.3 }}>{task.title}</span>
        {task.priorityColor && (
          <span title={task.priorityLabel} style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
            marginTop: 3, background: task.priorityColor }} />
        )}
      </div>

      {/* Type pill */}
      {task.typeLabel && <div style={{ marginBottom: 8 }}><StatusPill label={task.typeLabel} color={task.typeColor} /></div>}

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
          <span style={{ fontSize: 11, color: isOverdue(task) ? 'var(--color-danger)' : 'var(--text-muted)',
            fontWeight: isOverdue(task) ? 600 : 400 }}>{formatDate(task.due)}</span>
        )}
      </div>
    </div>
  )
}

// A single status column with its cards.
function BoardColumnView({ column, items, onDragStart, onDrop, onDragOver, onSelect, selectedId, emptyText, formatDate, bureauLabel }: {
  column: BoardColumn; items: Task[]
  onDragStart: (e: DragEvent<HTMLDivElement>, id: Id | undefined) => void
  onDrop: (e: DragEvent<HTMLDivElement>, statusKey: string | number) => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onSelect: (t: Task) => void
  selectedId?: Id | null
  emptyText: ReactNode
  formatDate: FormatDate
  bureauLabel: ReactNode
}) {
  return (
    <div style={{ width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column' }}
      onDrop={e => onDrop(e, column.key)} onDragOver={onDragOver}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{column.label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 99,
          background: column.color + '20', color: column.color }}>{items.length}</span>
      </div>
      <div style={{ flex: 1, minHeight: 80, borderRadius: 10,
        border: items.length === 0 ? '1px dashed var(--border)' : 'none' }}>
        {items.length === 0 ? (
          <div style={{ padding: '24px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>{emptyText}</div>
        ) : items.map(task => (
          <BoardCard key={task.id} task={task} onDragStart={onDragStart}
            onClick={onSelect} selected={task.id === selectedId} formatDate={formatDate} bureauLabel={bureauLabel} />
        ))}
      </div>
    </div>
  )
}

/**
 * TasksBoard — kanban view, one column per task STATUS (the lookup, never hardcoded).
 * Presentational: the page owns the data and the status mutation (onMove). Mirrors
 * ApplicationsBoard.
 */
export default function TasksBoard({ rows, columns, onMove, onSelect, selectedId }: {
  rows: Task[]; columns: BoardColumn[]; onMove: (id: Id, statusKey: string | number) => void; onSelect: (t: Task) => void; selectedId?: Id | null
}) {
  const { t } = useTranslation('tasks')
  const { formatDate } = useDateFormat()
  const dragId = useRef<Id | null>(null)

  const handleDragStart = (e: DragEvent<HTMLDivElement>, id: Id | undefined) => { dragId.current = id ?? null; e.dataTransfer.effectAllowed = 'move' }
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const handleDrop = (e: DragEvent<HTMLDivElement>, statusKey: string | number) => {
    e.preventDefault()
    if (dragId.current != null) { onMove(dragId.current, statusKey); dragId.current = null }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 20px' }}>
      <div style={{ display: 'flex', gap: 16, minWidth: 'max-content', paddingBottom: 8 }}>
        {columns.map(column => (
          <BoardColumnView key={column.key} column={column}
            items={rows.filter(r => r.statusKey === column.key)}
            onDragStart={handleDragStart} onDrop={handleDrop} onDragOver={handleDragOver}
            onSelect={onSelect} selectedId={selectedId} emptyText={t('board.empty')}
            formatDate={formatDate} bureauLabel={t('bureau')} />
        ))}
      </div>
    </div>
  )
}
