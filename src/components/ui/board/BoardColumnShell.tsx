/**
 * BoardColumnShell — one kanban column: BoardColumnHeader (label/count/colour) +
 * a dashed-bordered empty box or the item loop, shared by MatchesBoard and
 * TasksBoard (DRY round 11, PAGES; identical DOM in both). ApplicationsBoard's
 * column has a different width/minHeight and no empty-state affordance, and
 * OpportunitiesBoard hand-rolls its own header — neither carries this shell
 * (measured difference, see the lane report). The row renderer is a render prop
 * so this stays ignorant of each entity's own card component/props. The header
 * count is derived from `items` so a caller can never show a number that disagrees
 * with the rows below it (the counter-cell/drill-down population canon).
 */
import type { DragEvent, ReactNode } from 'react'
import BoardColumnHeader from './BoardColumnHeader'

export interface BoardColumnShellProps<T> {
  label: ReactNode
  color?: string
  showDot?: boolean
  onDrop: (e: DragEvent<HTMLDivElement>) => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  items: T[]
  emptyText: ReactNode
  renderItem: (item: T) => ReactNode
}

export default function BoardColumnShell<T>({
  label, color, showDot, onDrop, onDragOver, items, emptyText, renderItem,
}: BoardColumnShellProps<T>) {
  return (
    <div style={{ width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column' }}
      onDrop={onDrop} onDragOver={onDragOver}>
      <BoardColumnHeader label={label} count={items.length} color={color} showDot={showDot} />
      <div style={{ flex: 1, minHeight: 80, borderRadius: 10,
        border: items.length === 0 ? '1px dashed var(--border)' : 'none' }}>
        {items.length === 0 ? (
          <div style={{ padding: '24px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>{emptyText}</div>
        ) : items.map(renderItem)}
      </div>
    </div>
  )
}
