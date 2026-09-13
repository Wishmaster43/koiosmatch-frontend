/**
 * useBoardDrag — drag-and-drop wiring for kanban boards. Returns dragId ref,
 * auto-scroll ref+handler, and the three standard DnD handlers (start/over/drop).
 */
import { useRef, type DragEvent, type RefObject } from 'react'
import type { Id } from '@/types/common'
import { useDragAutoScroll } from '@/lib/useDragAutoScroll'

export interface UseBoardDragOptions<TTarget = string | number> {
  onMove: (id: Id, target: TTarget) => void
}

export interface UseBoardDragReturn<T extends HTMLElement = HTMLDivElement, TTarget = string | number> {
  dragId: React.MutableRefObject<Id | null>
  boardScrollRef: RefObject<T | null>
  boardAutoScroll: (e: DragEvent<T>) => void
  handleDragStart: (e: DragEvent<T>, id: Id | undefined) => void
  handleDragOver: (e: DragEvent<T>) => void
  handleDrop: (e: DragEvent<T>, target: TTarget) => void
}

export function useBoardDrag<T extends HTMLElement = HTMLDivElement, TTarget = string | number>({
  onMove,
}: UseBoardDragOptions<TTarget>): UseBoardDragReturn<T, TTarget> {
  // Tracks the currently dragged card's id without forcing a re-render.
  const dragId = useRef<Id | null>(null)

  // Auto-scroll the board horizontally while dragging (native DnD never scrolls itself).
  const { ref: boardScrollRef, onDragOver: boardAutoScroll } = useDragAutoScroll<T>()

  const handleDragStart = (e: DragEvent<T>, id: Id | undefined) => {
    dragId.current = id ?? null
    e.dataTransfer.effectAllowed = 'move'
  }

  // Allow the drop by cancelling the default (native DnD blocks drops otherwise).
  const handleDragOver = (e: DragEvent<T>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  // Commit the move to the target column/lane and clear the dragged id.
  const handleDrop = (e: DragEvent<T>, target: TTarget) => {
    e.preventDefault()
    if (dragId.current != null) {
      onMove(dragId.current, target)
      dragId.current = null
    }
  }

  return {
    dragId,
    boardScrollRef,
    boardAutoScroll,
    handleDragStart,
    handleDragOver,
    handleDrop,
  }
}
