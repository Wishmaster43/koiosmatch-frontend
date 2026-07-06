/**
 * useDragAutoScroll — horizontal edge-scrolling for kanban boards during an HTML5
 * drag. Native DnD never scrolls the container, so a column outside the viewport
 * was literally unreachable (Danny: "kan niet slepen" on boards whose cards sit
 * in far-right columns). Attach the returned handler to the scroll container's
 * onDragOver; it nudges the scroll position while the pointer nears an edge.
 */
import { useRef, useCallback } from 'react'
import type { DragEvent } from 'react'

const EDGE = 80   // px from the container edge that triggers scrolling
const STEP = 24   // px scrolled per dragover tick

export function useDragAutoScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)

  // dragover fires continuously while dragging — cheap math only, no state.
  const onDragOver = useCallback((e: DragEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (e.clientX > r.right - EDGE) el.scrollLeft += STEP
    else if (e.clientX < r.left + EDGE) el.scrollLeft -= STEP
  }, [])

  return { ref, onDragOver }
}
