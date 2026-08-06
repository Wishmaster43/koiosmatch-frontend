import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * useDraggablePanel (POPUP-SLEEP-1) — pointer-based drag + optional SE-corner
 * resize for a floating dialog panel. Blueprint = useKoiosPanelWidth (the house
 * pointer/clamp/persist pattern), extended to two dimensions. The panel starts
 * centered (pos null = CSS centering); the first drag switches to absolute
 * coordinates. Position/size persist per `persistKey` in localStorage so a
 * recruiter's window lands where they left it. Double-click on the drag handle
 * resets to centered/default (the escape hatch when a window ends up off-view
 * after a monitor change).
 */
export interface PanelPlacement {
  x: number
  y: number
  w: number | null
  h: number | null
}

const MARGIN = 8 // px of panel that must always stay reachable

// Clamp so the drag handle can never fully leave the viewport (else the window
// becomes unrecoverable without the double-click reset).
function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

function storageKey(key: string): string {
  return `km-float-${key}`
}

export function useDraggablePanel(persistKey?: string, resizable = true) {
  const panelRef = useRef<HTMLDivElement>(null)
  // null = centered via CSS (the pre-drag default every modal has today).
  const [placement, setPlacement] = useState<PanelPlacement | null>(() => {
    if (!persistKey) return null
    try {
      const raw = localStorage.getItem(storageKey(persistKey))
      if (!raw) return null
      const p = JSON.parse(raw) as PanelPlacement
      // A stored spot from a bigger monitor may be off-screen here — reclamp on boot.
      return {
        ...p,
        x: clamp(p.x, MARGIN - (p.w ?? 400) + 80, window.innerWidth - 80),
        y: clamp(p.y, 0, window.innerHeight - 48),
      }
    } catch {
      return null
    }
  })

  const persist = useCallback((p: PanelPlacement | null) => {
    if (!persistKey) return
    try {
      if (p === null) localStorage.removeItem(storageKey(persistKey))
      else localStorage.setItem(storageKey(persistKey), JSON.stringify(p))
    } catch { /* storage full/blocked — floating still works, just not remembered */ }
  }, [persistKey])

  // Current placement in a ref so pointermove handlers never see stale state
  // (synced in an effect — writing a ref during render is a lint error).
  const placementRef = useRef(placement)
  useEffect(() => {
    placementRef.current = placement
  }, [placement])

  /** Attach to the header: pointer-drag moves the panel. */
  const onDragPointerDown = useCallback((e: React.PointerEvent) => {
    // Ignore drags starting on interactive elements (close button etc.).
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return
    const node = panelRef.current
    if (!node) return
    e.preventDefault()
    const rect = node.getBoundingClientRect()
    const start = placementRef.current ?? { x: rect.left, y: rect.top, w: null, h: null }
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top

    const move = (ev: PointerEvent) => {
      const next: PanelPlacement = {
        ...start,
        x: clamp(ev.clientX - offsetX, MARGIN - rect.width + 80, window.innerWidth - 80),
        y: clamp(ev.clientY - offsetY, 0, window.innerHeight - 48),
      }
      placementRef.current = next
      setPlacement(next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      persist(placementRef.current)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [persist])

  /** Attach to the SE corner handle: pointer-drag resizes the panel. */
  const onResizePointerDown = useCallback((e: React.PointerEvent) => {
    if (!resizable) return
    const node = panelRef.current
    if (!node) return
    e.preventDefault()
    e.stopPropagation()
    const rect = node.getBoundingClientRect()
    const start = placementRef.current ?? { x: rect.left, y: rect.top, w: null, h: null }
    const baseW = rect.width
    const baseH = rect.height
    const fromX = e.clientX
    const fromY = e.clientY

    const move = (ev: PointerEvent) => {
      const next: PanelPlacement = {
        // Resizing pins the panel where it stands (switches from centered to absolute).
        x: start.x ?? rect.left,
        y: start.y ?? rect.top,
        w: clamp(baseW + (ev.clientX - fromX), 320, window.innerWidth - MARGIN),
        h: clamp(baseH + (ev.clientY - fromY), 200, window.innerHeight - MARGIN),
      }
      placementRef.current = next
      setPlacement(next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      persist(placementRef.current)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [persist, resizable])

  /** Double-click the handle: back to centered/default size (recovery hatch). */
  const onDragHandleDoubleClick = useCallback(() => {
    placementRef.current = null
    setPlacement(null)
    persist(null)
  }, [persist])

  // A window resize may strand the panel off-view — reclamp it back into reach.
  useEffect(() => {
    const onWinResize = () => {
      const p = placementRef.current
      if (!p) return
      const next = {
        ...p,
        x: clamp(p.x, MARGIN - (p.w ?? 400) + 80, window.innerWidth - 80),
        y: clamp(p.y, 0, window.innerHeight - 48),
      }
      placementRef.current = next
      setPlacement(next)
    }
    window.addEventListener('resize', onWinResize)
    return () => window.removeEventListener('resize', onWinResize)
  }, [])

  return { panelRef, placement, onDragPointerDown, onResizePointerDown, onDragHandleDoubleClick }
}
