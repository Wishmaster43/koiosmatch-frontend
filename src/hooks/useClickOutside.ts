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
 */
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

// Fires `onOutside` on a mousedown outside every given ref, only while `enabled`.
export function useClickOutside(refs: Array<RefObject<HTMLElement | null>>, enabled: boolean, onOutside: () => void) {
  // Latest args without re-subscribing: keeps the listener lifecycle at one
  // add/remove per `enabled` toggle, not one per render.
  const refsRef = useRef(refs)
  const onOutsideRef = useRef(onOutside)
  useEffect(() => {
    refsRef.current = refs
    onOutsideRef.current = onOutside
  })
  useEffect(() => {
    if (!enabled) return
    // Ignores clicks inside any tracked ref (trigger + portalled menu); anything else is outside.
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (refsRef.current.some(r => r.current?.contains(target))) return
      onOutsideRef.current()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [enabled])
}
