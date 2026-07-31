/**
 * useKoiosPanelWidth — persists the Koios panel's width in PIXELS (a non-PII
 * UI preference), replacing the old boolean expand/collapse flag (formerly
 * useKoiosExpanded) so the panel remembers a size the user actually dragged
 * to, not just one of two hardcoded presets. Also drives: legacy boolean
 * migration, viewport-aware clamping, the toggle button's snap-to-preset
 * behaviour, and pointer + keyboard resize handling for the drag handle.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

// The two "known good" widths the toggle button still snaps between —
// unchanged from the old fixed-size panel so existing muscle memory holds.
export const WIDTH_COLLAPSED = 300
export const WIDTH_EXPANDED = 560

// A drag must never collapse the panel into an unusable sliver, and never
// swallow the whole window — the ceiling is also capped to a share of the
// viewport so a narrow browser window doesn't lose all its content.
const MIN_WIDTH = 260
const MAX_WIDTH_ABSOLUTE = 720
const MAX_WIDTH_VIEWPORT_RATIO = 0.6
// Arrow-key step for the keyboard-operable separator (§6 WCAG 2.2 AA).
const KEYBOARD_STEP = 20

const WIDTH_KEY = 'koios.width'
const LEGACY_EXPANDED_KEY = 'koios.expanded'

// The viewport-aware ceiling, recomputed live from the current window size —
// never memoized, since a stale cap would let a drag exceed a since-shrunk window.
function computeMaxWidth(): number {
  if (typeof window === 'undefined') return MAX_WIDTH_ABSOLUTE
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH_ABSOLUTE, Math.round(window.innerWidth * MAX_WIDTH_VIEWPORT_RATIO)))
}

function clamp(px: number): number {
  return Math.min(computeMaxWidth(), Math.max(MIN_WIDTH, Math.round(px)))
}

// Read the persisted width (tolerant of corrupt/absent/private-mode storage,
// mirroring the old useKoiosExpanded read). A pre-existing 'koios.expanded'
// boolean — the only thing older browsers have stored — upgrades to its
// matching known width ONCE: a user who had it expanded keeps a wide panel
// instead of silently regressing to the 300px collapsed default (or worse,
// some undefined width). The legacy key is left in place; the new numeric
// key always takes precedence once it exists, so it is only ever read once.
function readWidth(): number {
  try {
    const stored = localStorage.getItem(WIDTH_KEY)
    if (stored !== null) {
      const parsed = Number(stored)
      if (Number.isFinite(parsed)) return clamp(parsed)
    }
    const legacyExpanded = localStorage.getItem(LEGACY_EXPANDED_KEY)
    if (legacyExpanded !== null) return clamp(legacyExpanded === 'true' ? WIDTH_EXPANDED : WIDTH_COLLAPSED)
    return WIDTH_COLLAPSED
  } catch {
    return WIDTH_COLLAPSED
  }
}

export function useKoiosPanelWidth() {
  const [width, setWidth] = useState<number>(readWidth)
  const [maxWidth, setMaxWidth] = useState<number>(computeMaxWidth)
  const [isDragging, setIsDragging] = useState(false)
  // Drag-start snapshot so pointermove computes from a delta, not an absolute
  // cursor position — the handle can be grabbed anywhere along its height.
  const dragStartRef = useRef<{ x: number; width: number } | null>(null)

  // Persist a new width (clamped) and keep it in state; swallow storage errors
  // (quota / private mode) exactly like the old boolean hook did.
  const commitWidth = useCallback((next: number) => {
    const clamped = clamp(next)
    setWidth(clamped)
    try { localStorage.setItem(WIDTH_KEY, String(clamped)) } catch { /* quota / private mode — stays in memory */ }
  }, [])

  // Re-clamp whenever the window is resized narrower than the stored width,
  // and refresh the exposed ceiling so the handle's aria-valuemax stays live.
  useEffect(() => {
    const onResize = () => {
      const nextMax = computeMaxWidth()
      setMaxWidth(nextMax)
      setWidth(w => Math.min(w, nextMax))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // The toggle button snaps to the OTHER known preset rather than flipping a
  // stored boolean — so a freely-dragged width still resolves predictably:
  // whichever side of the collapsed/expanded midpoint it's on decides which
  // preset the button jumps to next. This is how a free width and the
  // existing two-size toggle coexist without one silently overriding the other.
  const isExpanded = width > (WIDTH_COLLAPSED + WIDTH_EXPANDED) / 2
  const toggle = useCallback(() => {
    commitWidth(isExpanded ? WIDTH_COLLAPSED : WIDTH_EXPANDED)
  }, [isExpanded, commitWidth])

  // Pointer-driven resize. RichTextEditor's `resizable` prop (the repo's only
  // other "drag to resize" feature) uses native CSS `resize: vertical`, which
  // cannot be read back into state, clamped against the viewport, persisted,
  // or driven from the keyboard — all required here — so this handle needs
  // its own pointermove/up wiring instead of that pattern.
  const startDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragStartRef.current = { x: e.clientX, width }
    setIsDragging(true)
  }, [width])

  // Listeners live ONLY while dragging, and come off on drag end AND on
  // unmount (the cleanup function covers both) — no leaked global listeners.
  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: PointerEvent) => {
      const start = dragStartRef.current
      if (!start) return
      // The panel sits left of its resizable edge, so dragging right grows it.
      commitWidth(start.width + (e.clientX - start.x))
    }
    const onUp = () => { setIsDragging(false); dragStartRef.current = null }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    // Avoid text-selection artifacts elsewhere on the page while dragging.
    const prevUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = prevUserSelect
    }
  }, [isDragging, commitWidth])

  // Keyboard resize on the handle (WAI-ARIA "separator" pattern, §6): arrow
  // keys step the width, Home/End jump to the min/max bounds.
  const onHandleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); commitWidth(width + KEYBOARD_STEP) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); commitWidth(width - KEYBOARD_STEP) }
    else if (e.key === 'Home') { e.preventDefault(); commitWidth(MIN_WIDTH) }
    else if (e.key === 'End') { e.preventDefault(); commitWidth(computeMaxWidth()) }
  }, [width, commitWidth])

  return { width, minWidth: MIN_WIDTH, maxWidth, isExpanded, isDragging, toggle, startDrag, onHandleKeyDown }
}
