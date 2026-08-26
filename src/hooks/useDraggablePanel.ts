/**
 * useDraggablePanel (POPUP-SLEEP-1) — THE one drag/resize engine for every floating
 * popup in the app (Danny 06-08 + point 19, translated: "every popup must be
 * draggable" — verbatim: "elke popup sleepbaar"). Blueprint =
 * useKoiosPanelWidth (the house pointer/clamp/persist pattern), extended to two
 * dimensions. The panel starts centered (placement null = CSS centering); the first
 * drag switches to absolute coordinates. Position/size persist per `persistKey` in
 * localStorage so a recruiter's window lands where they left it. Double-click on the
 * drag handle resets to centered/default — the single-pointer escape hatch when a
 * window ends up off-view after a monitor change (and the WCAG 2.5.7 alternative:
 * dragging only MOVES a window, it is never the only way to reach a function).
 *
 * Never a second drag implementation: FloatingPanel is the only consumer and every
 * popup shell goes through FloatingPanel (§11).
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface PanelPlacement {
  // null = CSS-centered (walkthrough 21-08 POP-UPS 3.4: position never survives
  // a close; only size does). Real numbers appear once the user drags.
  x: number | null
  y: number | null
  w: number | null
  h: number | null
}

const MARGIN = 8 // px of breathing room when a panel is resized to the viewport edge
const KEEP_VISIBLE = 80 // px of the panel that must ALWAYS stay inside the viewport
const HANDLE_H = 48 // the header strip's height — it may never leave the bottom edge
const FALLBACK_W = 400 // assumed width when a stored placement has no measured size

// Shared min/max clamp reused by every drag/resize path below.
function clampNumber(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

/**
 * The ONE viewport clamp, used by every path that can move a panel (drag, window
 * resize, boot from storage). A window may hang over an edge, but never far enough
 * to disappear: at least KEEP_VISIBLE px stays reachable horizontally and the header
 * strip always stays on screen vertically. Exported for the regression test.
 */
export function clampToViewport(x: number, y: number, w: number | null): { x: number; y: number } {
  const width = w ?? FALLBACK_W
  return {
    x: clampNumber(x, KEEP_VISIBLE - width, Math.max(0, window.innerWidth - KEEP_VISIBLE)),
    y: clampNumber(y, 0, Math.max(0, window.innerHeight - HANDLE_H)),
  }
}

// Namespaces the persisted placement so it never collides with unrelated localStorage keys.
function storageKey(key: string): string {
  return `km-float-${key}`
}

// Central drag/resize/persist engine shared by every floating panel (see file header for the design rationale).
export function useDraggablePanel(persistKey?: string, resizable = true) {
  const panelRef = useRef<HTMLDivElement>(null)
  // null = centered via CSS (the pre-drag default every modal has today).
  // POSITION deliberately does NOT survive a close (walkthrough 21-08, POP-UPS
  // 3.4, translated: "sometimes this opens high on your screen instead of in
  // the middle" — verbatim: "soms opent deze hoog in je scherm en niet in het
  // midden" — a panel once parked high reopened there forever). Every open starts centered; only
  // the user's chosen SIZE is restored, dragging works within the open panel.
  const [placement, setPlacement] = useState<PanelPlacement | null>(() => {
    if (!persistKey) return null
    try {
      const raw = localStorage.getItem(storageKey(persistKey))
      if (!raw) return null
      const p = JSON.parse(raw) as PanelPlacement
      if (p.w == null && p.h == null) return null
      // Size-only restore: x/y null keeps the CSS-centered layout path.
      return { x: null, y: null, w: p.w ?? null, h: p.h ?? null }
    } catch {
      return null
    }
  })
  // True only while a pointer drag/resize is in flight — consumers switch their
  // transitions off with it, so a dragged window never lags behind the cursor.
  const [dragging, setDragging] = useState(false)

  // Writes (or clears) the placement to localStorage; failures are swallowed so a full/blocked store never breaks dragging.
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
  // Keep the ref in sync with state after each render so pointer handlers always read the latest placement, not a stale closure.
  useEffect(() => {
    placementRef.current = placement
  }, [placement])

  // Suppress text selection for the DURATION of a drag only (a cursor sweeping over
  // the body would otherwise select the content it passes) — restored on pointerup,
  // so selecting text in the panel keeps working exactly as before.
  const suppressSelection = useCallback(() => {
    const previous = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    return () => { document.body.style.userSelect = previous }
  }, [])

  /** Attach to the header: pointer-drag moves the panel. */
  const onDragPointerDown = useCallback((e: React.PointerEvent) => {
    // Ignore drags starting on interactive elements (close button etc.).
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return
    const node = panelRef.current
    if (!node) return
    e.preventDefault()
    const rect = node.getBoundingClientRect()
    const stored = placementRef.current
    const start = (stored && stored.x != null && stored.y != null)
      ? (stored as { x: number; y: number; w: number | null; h: number | null })
      : { x: rect.left, y: rect.top, w: stored?.w ?? null, h: stored?.h ?? null }
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    const restoreSelection = suppressSelection()
    setDragging(true)
    // Clamp against the panel's real width: a user-resized panel keeps its stored
    // `w`, an untouched one is measured from the DOM (0 in jsdom → fall back).
    const clampWidth = start.w ?? (rect.width || null)

    // Pointer move while dragging: reapply the initial cursor offset and clamp the result into view.
    const move = (ev: PointerEvent) => {
      const next: PanelPlacement = {
        ...start,
        ...clampToViewport(ev.clientX - offsetX, ev.clientY - offsetY, clampWidth),
      }
      placementRef.current = next
      setPlacement(next)
    }
    // Pointer up ends the drag: detach the listeners, restore text selection, and persist the final placement.
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      restoreSelection()
      setDragging(false)
      persist(placementRef.current)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [persist, suppressSelection])

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
    const restoreSelection = suppressSelection()
    setDragging(true)

    // Pointer move while resizing: grow/shrink from the starting rect, clamped to sane min/viewport-max bounds.
    const move = (ev: PointerEvent) => {
      const next: PanelPlacement = {
        // Resizing pins the panel where it stands (switches from centered to absolute).
        x: start.x ?? rect.left,
        y: start.y ?? rect.top,
        w: clampNumber(baseW + (ev.clientX - fromX), 320, window.innerWidth - MARGIN),
        h: clampNumber(baseH + (ev.clientY - fromY), 200, window.innerHeight - MARGIN),
      }
      placementRef.current = next
      setPlacement(next)
    }
    // Pointer up ends the resize: detach the listeners, restore selection, and persist the new size.
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      restoreSelection()
      setDragging(false)
      persist(placementRef.current)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [persist, resizable, suppressSelection])

  /** Double-click the handle: back to centered/default size (recovery hatch). */
  const onDragHandleDoubleClick = useCallback(() => {
    placementRef.current = null
    setPlacement(null)
    persist(null)
  }, [persist])

  // A window resize may strand the panel off-view — reclamp it back into reach.
  useEffect(() => {
    // Reclamp only a panel already pinned by a drag (x/y set); a centered panel needs no adjustment.
    const onWinResize = () => {
      const p = placementRef.current
      // Centered placements (x/y null) have nothing to reclamp — CSS keeps them centered.
      if (!p || p.x == null || p.y == null) return
      const next = { ...p, ...clampToViewport(p.x, p.y, p.w) }
      placementRef.current = next
      setPlacement(next)
    }
    window.addEventListener('resize', onWinResize)
    return () => window.removeEventListener('resize', onWinResize)
  }, [])

  return { panelRef, placement, dragging, onDragPointerDown, onResizePointerDown, onDragHandleDoubleClick }
}
