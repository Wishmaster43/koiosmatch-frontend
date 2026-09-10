/**
 * BoardScrollArea — the outer horizontal-scroll shell every kanban board renders
 * its columns into: the drag-auto-scroll container plus the flex row that holds
 * the columns (DRY round 11, PAGES). Shared by ApplicationsBoard, MatchesBoard
 * and TasksBoard (identical DOM/style in all three); OpportunitiesBoard uses a
 * different layout (single flex row, different gap/padding, no dashed columns)
 * and is left as-is (measured difference, see the lane report).
 */
import type { DragEvent, ReactNode, RefObject } from 'react'

export interface BoardScrollAreaProps {
  scrollRef: RefObject<HTMLDivElement | null>
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  children: ReactNode
}

export default function BoardScrollArea({ scrollRef, onDragOver, children }: BoardScrollAreaProps) {
  return (
    <div ref={scrollRef} onDragOver={onDragOver} style={{ flex: 1, overflow: 'auto', padding: '0 24px 20px' }}>
      <div style={{ display: 'flex', gap: 16, minWidth: 'max-content', paddingBottom: 8 }}>
        {children}
      </div>
    </div>
  )
}
