import { useCallback, useRef } from 'react'
import type { KeyboardEvent } from 'react'

interface UseRovingTabsArgs {
  // Ordered tab ids — arrow/Home/End navigate this list, wrapping at the ends.
  ids: string[]
  // The host's current active tab id. This hook never holds its own selection
  // state, so aria-selected/tabIndex can never disagree with the host's prop —
  // both drawer tab strips are purely presentational (§3A).
  active: string | undefined
  onChange: (id: string) => void
}

/**
 * useRovingTabs — shared WAI-ARIA APG "tabs" keyboard model (automatic
 * activation): Left/Right move + select the neighbouring tab, Home/End jump to
 * the first/last, wrapping at the ends; roving tabindex so Tab enters the
 * strip once and arrows move within it. One hook for every tablist in the app
 * (SubTabBar, DrawerTabs) — CLAUDE.md §11: a second hand-written copy of this
 * exact logic is the kind of drift the audit flagged (§6, WCAG 2.2 AA — a
 * role="tablist" that ignores arrow keys is a lie to screen-reader users).
 */
export function useRovingTabs({ ids, active, onChange }: UseRovingTabsArgs) {
  // Per-id button node + stable ref-callback maps, kept in refs (not state) so
  // a fresh function identity every render never detaches/reattaches the DOM ref.
  const nodes = useRef(new Map<string, HTMLButtonElement>())
  const callbacks = useRef(new Map<string, (el: HTMLButtonElement | null) => void>())

  // One stable ref-callback per tab id, created lazily and cached for the
  // component's lifetime.
  const getRef = useCallback((id: string) => {
    let cb = callbacks.current.get(id)
    if (!cb) {
      cb = (el) => { if (el) nodes.current.set(id, el); else nodes.current.delete(id) }
      callbacks.current.set(id, cb)
    }
    return cb
  }, [])

  // Falls back to the first tab so the strip is never entirely un-tabbable —
  // e.g. before the host's `active` prop settles on a real id.
  const activeId = ids.includes(active ?? '') ? (active as string) : ids[0]

  // Moves selection AND DOM focus together (automatic activation) and scrolls
  // the newly active tab into view — some hosts render the strip inside a
  // horizontally scrolling container.
  const moveTo = (id: string) => {
    onChange(id)
    const node = nodes.current.get(id)
    node?.focus()
    node?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }

  // Arrow keys move + select; Home/End jump to the first/last tab; wraps at
  // both ends. Attach to the tablist container — the event bubbles up from
  // whichever tab currently has focus.
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const currentIndex = ids.indexOf(activeId)
    if (currentIndex === -1) return
    let nextIndex: number | null = null
    if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % ids.length
    else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + ids.length) % ids.length
    else if (e.key === 'Home') nextIndex = 0
    else if (e.key === 'End') nextIndex = ids.length - 1
    if (nextIndex === null) return
    e.preventDefault()
    moveTo(ids[nextIndex])
  }

  // Roving tabindex: only the active tab sits in the natural Tab order.
  const tabIndexFor = (id: string) => (id === activeId ? 0 : -1)

  return { getRef, onKeyDown, tabIndexFor }
}
