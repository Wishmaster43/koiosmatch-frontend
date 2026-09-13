/**
 * useClickOutside — shared "close on outside click" wiring for the house
 * dropdown primitives (DUP-03). Listens for `mousedown` while `enabled` is
 * true, and fires `onOutside` unless the click landed inside ANY of the given
 * refs. Several refs matter because a portal-rendered popover (SelectMenu,
 * CreatableSelect, SearchSelect all use `createPortal`) lives outside the
 * trigger's own DOM subtree — its ref must ALSO count as "inside", or picking
 * an option would self-close the menu before the option's own click handler
 * runs. The subscription itself only depends on `enabled` (refs/onOutside are
 * read via a ref on every call) — this matches the three replaced effects,
 * which all had deps `[open]` and so subscribed once per open, not once per
 * render, even though call sites pass fresh array/arrow literals each render.
 *
 * `ignoreDropdownPortal` (DRY round 11, CANDTABS) additionally treats a click
 * inside ANY portalled dropdown menu (SelectMenu/CreatableSelect/SearchSelect)
 * as "inside" too, for a host whose own small dropdown carries no such portal
 * itself — mirrors the hand-rolled guard PoolsSection and DashboardSwitcher
 * both carried before adopting this hook.
 */
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { isInsideDropdownPortal } from '@/lib/useDropdownPlacement'

export interface UseClickOutsideOptions {
  // PORTAL-MARKER-1: a click inside an open portalled picker menu is never "outside".
  ignoreDropdownPortal?: boolean
}

// Fires `onOutside` on a mousedown outside every given ref, only while `enabled`.
export function useClickOutside(
  refs: Array<RefObject<HTMLElement | null>>, enabled: boolean, onOutside: () => void, options?: UseClickOutsideOptions,
) {
  // Latest args without re-subscribing: keeps the listener lifecycle at one
  // add/remove per `enabled` toggle, not one per render.
  const refsRef = useRef(refs)
  const onOutsideRef = useRef(onOutside)
  const optionsRef = useRef(options)
  useEffect(() => {
    refsRef.current = refs
    onOutsideRef.current = onOutside
    optionsRef.current = options
  })
  // Attaches (and tears down) the outside-click listener only when enabled toggles.
  useEffect(() => {
    if (!enabled) return
    // Ignores a click inside a portalled dropdown menu (when asked to), then any
    // tracked ref (trigger + portalled menu); anything else is outside.
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (optionsRef.current?.ignoreDropdownPortal && isInsideDropdownPortal(target)) return
      if (refsRef.current.some(r => r.current?.contains(target))) return
      onOutsideRef.current()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [enabled])
}
