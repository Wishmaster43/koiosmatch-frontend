/**
 * useDropdownPlacement — shared flip + clamp logic for inline (non-portal)
 * dropdown popovers (CreatableSelect, SearchSelect). A field near the bottom of
 * a scrollable panel (drawer/modal) would otherwise render a downward popover
 * that gets clipped by the panel's own `overflow: hidden` and effectively
 * disappears (Danny screenshots, kandidaten-ronde-2: both the province combobox
 * AND the "+ Vestiging" branches picker hit this at the bottom of the +Kandidaat
 * modal). One shared hook — CLAUDE.md §11: two copies of flip logic is exactly
 * the kind of drift that must not happen twice.
 *
 * On open, measures the anchor against the viewport (the same simplified flip
 * technique popper-style menu libs use without a portal) and returns:
 * - `openUp`: true when there is less room below the anchor than the menu cap,
 *   AND more room above than below — so it only flips when it actually helps.
 * - `maxHeight`: the menu's clamped height so it never renders past whichever
 *   edge it opens toward.
 */
import { useState, useEffect } from 'react'
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

export interface DropdownPlacement {
  openUp: boolean
  maxHeight: number
}

export function useDropdownPlacement(anchorRef: RefObject<HTMLElement | null>, open: boolean): DropdownPlacement {
  const [placement, setPlacement] = useState<DropdownPlacement>({ openUp: false, maxHeight: MENU_HEIGHT_CAP })

  useEffect(() => {
    if (!open || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN
    const spaceAbove = rect.top - VIEWPORT_MARGIN
    const openUp = spaceBelow < MENU_HEIGHT_CAP && spaceAbove > spaceBelow
    setPlacement({ openUp, maxHeight: Math.max(MIN_MENU_HEIGHT, Math.min(MENU_HEIGHT_CAP, openUp ? spaceAbove : spaceBelow)) })
    // anchorRef is a stable ref object — only re-measure when the menu opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return placement
}
