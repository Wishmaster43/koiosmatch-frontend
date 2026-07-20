/**
 * useDropdownPlacement — shared flip + clamp + PORTAL-position logic for
 * dropdown popovers (CreatableSelect, SearchSelect). One shared hook — CLAUDE.md
 * §11: two copies of this math is exactly the kind of drift that must not
 * happen twice.
 *
 * History: the first version measured the anchor against the VIEWPORT and
 * flipped up/clamped height accordingly — that fixed a popover overflowing past
 * the bottom of a modal, but NOT the drawer case (Danny, live): the candidate
 * drawer's own Profiel-tab scroll container is an OVERFLOW ANCESTOR, and it
 * clips an absolutely-positioned descendant outright regardless of z-index or
 * flip direction — the popover was rendered INSIDE that clipped box. Flipping up
 * still flips inside the same clipped box, so it does not help.
 *
 * Fix: the popover now renders through `createPortal` into `document.body` (in
 * the consuming components), escaping every overflow ancestor entirely. This
 * hook now also returns the anchor's `rect` in VIEWPORT coordinates so the
 * portalled popover can be positioned with `position: fixed` directly off that
 * rect — no portal-ancestor offset math needed, because `position: fixed`
 * coordinates are always relative to the viewport.
 */
import { useState, useLayoutEffect } from 'react'
import type { RefObject } from 'react'

// Hard cap on menu height, the margin kept clear of the viewport edge, and a
// floor so a very cramped viewport still shows a usable (if short) menu.
const MENU_HEIGHT_CAP = 240
const VIEWPORT_MARGIN = 8
const MIN_MENU_HEIGHT = 120

// Estimated rendered height of a popover's own search-input row (padding + input)
// — both consumers use it to derive how much is left for the scrollable option
// list once the outer popover height is clamped.
export const DROPDOWN_SEARCH_ROW_HEIGHT = 44

// z-index audit (2026-07-20): the highest in-app modal/drawer layer today is
// AddShiftModal at 1000; the Toaster sits at 9999 and must ALWAYS stay above
// everything, including an open dropdown. A portalled dropdown must out-rank
// whichever modal/drawer it was opened from, so this sits one tier above every
// existing modal — comfortably below the Toaster.
export const DROPDOWN_PORTAL_Z_INDEX = 1100

// A plain (serialisable, stable-shape) copy of the anchor's DOMRect — viewport
// coordinates, exactly what `position: fixed` consumes directly.
export interface AnchorRect { top: number; bottom: number; left: number; right: number; width: number }

export interface DropdownPlacement {
  openUp: boolean
  maxHeight: number
  // Null until the anchor has been measured at least once (menu closed, or the
  // very first synchronous layout pass before that measurement lands).
  rect: AnchorRect | null
}

const toAnchorRect = (r: DOMRect): AnchorRect => ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width })

export function useDropdownPlacement(anchorRef: RefObject<HTMLElement | null>, open: boolean): DropdownPlacement {
  const [placement, setPlacement] = useState<DropdownPlacement>({ openUp: false, maxHeight: MENU_HEIGHT_CAP, rect: null })

  // useLayoutEffect (not useEffect): measures + commits the position SYNCHRONOUSLY
  // before the browser paints, so the very first visible frame is already
  // correctly placed — no flash of an unpositioned/wrongly-positioned popover.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const measure = () => {
      if (!anchorRef.current) return
      const r = anchorRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - r.bottom - VIEWPORT_MARGIN
      const spaceAbove = r.top - VIEWPORT_MARGIN
      const openUp = spaceBelow < MENU_HEIGHT_CAP && spaceAbove > spaceBelow
      setPlacement({
        openUp,
        maxHeight: Math.max(MIN_MENU_HEIGHT, Math.min(MENU_HEIGHT_CAP, openUp ? spaceAbove : spaceBelow)),
        rect: toAnchorRect(r),
      })
    }
    measure()
    // The popover is now a PORTAL (document.body) — it escapes the overflow
    // ancestor that used to clip it, but it no longer scrolls WITH the anchor
    // either (a drawer/modal scroll container moving the anchor doesn't move a
    // body-level portal for free). REPOSITION (not close) on any ancestor
    // scroll/window resize: closing on scroll would be more disruptive mid-
    // interaction (e.g. still typing a search query, or scrolling the popover's
    // OWN option list, which also fires a 'scroll' event) than just keeping the
    // menu glued to the anchor. `capture: true` is required — 'scroll' does not
    // bubble, but capture-phase listeners on window still see it from any
    // scrollable descendant.
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- anchorRef is a stable ref object; only re-measure when the menu opens
  }, [open])

  return placement
}
