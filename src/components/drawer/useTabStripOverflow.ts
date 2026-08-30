/**
 * useTabStripOverflow — shared overflow treatment for any horizontally
 * scrolling tab strip (SETTINGS-TABS-OVERFLOW-1, Danny 30-08, then lifted
 * into the shared atom per the SubTabBar verdict: the tool-matrix's 12-tab
 * domain strip clipped 6 tabs at 1440 with no cue because SubTabBar never
 * got this treatment). Keeps the active tab scrolled into view on mount,
 * on every active-tab change, and on a ResizeObserver fire (a shrinking
 * viewport must not leave the selection off-screen); exposes which edge(s)
 * still have more content to scroll to, for an edge-fade cue. One
 * implementation so SubTabBar and SettingsTabs behave identically.
 */
import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'

export interface TabStripEdges { left: boolean; right: boolean }

export function useTabStripOverflow(
  containerRef: RefObject<HTMLElement | null>,
  activeRef: RefObject<HTMLElement | null>,
  active: string | null | undefined,
  count: number,
): { edges: TabStripEdges } {
  const [edges, setEdges] = useState<TabStripEdges>({ left: false, right: false })

  // Recompute the left/right edge fades from the container's current scroll
  // position; bails out on an unchanged value so a scroll frame doesn't
  // re-render the whole strip.
  const updateEdges = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const left = el.scrollLeft > 1
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
  }, [containerRef])

  // Bring the active tab into view, then refresh the edge fades — shared by
  // the mount/active-change effect AND the resize path below (a resize must
  // re-scroll the active tab too, not only recompute the fades).
  const syncActiveTab = useCallback(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    updateEdges()
  }, [activeRef, updateEdges])

  // Bring the active tab into view whenever it changes (including first mount).
  useEffect(() => { syncActiveTab() }, [active, syncActiveTab])

  // Track scroll + resize so edge fades AND the active tab's visibility stay
  // honest as the viewport or the tab set changes.
  useEffect(() => {
    updateEdges()
    const el = containerRef.current
    if (!el) return undefined
    el.addEventListener('scroll', updateEdges, { passive: true })
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(syncActiveTab)
      ro.observe(el)
    }
    return () => { el.removeEventListener('scroll', updateEdges); ro?.disconnect() }
    // Re-measure whenever the tab set itself changes (updateEdges/syncActiveTab are stable).
  }, [count, containerRef, updateEdges, syncActiveTab])

  return { edges }
}
