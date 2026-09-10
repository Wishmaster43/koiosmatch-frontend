/**
 * useDropdownPopover — the open/close plumbing every portalled house picker
 * (CreatableSelect, SelectMenu, SearchSelect) wired identically, in the same
 * order, one call at a time (DRY round 11, UIATOMS): a menu ref for the
 * portal, the shared flip/clamp/rect PLACEMENT (useDropdownPlacement stays the
 * placement source, CLAUDE.md §11: never a second copy of this math),
 * close-on-outside-click (the portalled menu ref counts as "inside" too, or
 * picking/toggling an option would self-close before the click handler runs;
 * only active while open, so a CLOSED menu never swallows an outside click
 * meant for something else — SelectMenu's PlanIntakeModal case), the layered
 * Escape-close (top layer first, so a modal underneath stays untouched while
 * the menu is open — closing even right after opening, before focus has moved
 * into the portalled search input (CreatableSelect's reason), and no matter
 * which element inside it holds focus, an option button, not just the search
 * input (SearchSelect's reason)), and focus-restore back to the trigger.
 *
 * FOCUS-RESTORE MATTERS INSIDE A MODAL (moved here from SearchSelect, equally
 * true for all three): the menu's search input lives in a PORTAL and unmounts
 * on every close path, so focus would otherwise land on <body>. The house
 * focus trap listens on the modal's own node, and a portal is not a
 * descendant of it, so from <body> neither Escape nor Tab reaches the dialog
 * again (§6) — hence the resolver-based restore below, skipped when some
 * other element already claimed focus.
 *
 * The MENU SHELL itself (style, search box, option list) stays LOCAL to each
 * picker: measured in this round, it genuinely differs (radius 8 vs 10,
 * max-width + left/right alignment only on SearchSelect, a sticky-search
 * single-scroll container on SelectMenu vs a fixed search row + separately
 * scrolling list elsewhere) — so this hook owns only what is byte-for-byte
 * identical across all three, never the shell (DRY round 11 rule B: a shared unit carries the
 * consumers' differences as props).
 */
import { useRef } from 'react'
import type { RefObject } from 'react'
import { useDropdownPlacement } from '@/lib/useDropdownPlacement'
import { useClickOutside } from './useClickOutside'
import { useEscapeLayer } from './useEscapeLayer'
import { useDropdownFocusRestore } from './useDropdownFocusRestore'

// Wires the menu ref, placement, close-on-outside-click, layered Escape-close
// and focus-restore that every portalled picker menu needs identically.
export function useDropdownPopover(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  resolveFocusTarget: () => HTMLElement | null,
) {
  // The portalled menu lives outside `anchorRef`'s DOM subtree — its own ref
  // must ALSO count as "inside" for the outside-click check below.
  const menuRef = useRef<HTMLDivElement>(null)
  // Shared flip + clamp + rect placement (see useDropdownPlacement's own doc comment).
  const { openUp, maxHeight, rect } = useDropdownPlacement(anchorRef, open)

  // Close on outside click (shared DUP-03 hook); the portalled menu counts as
  // "inside" too, or picking/toggling an option would self-close before the click registers.
  useClickOutside([anchorRef, menuRef], open, onClose)

  // Overlay-close layer: Escape closes this menu, top layer first, so a modal
  // underneath stays untouched while the menu is open.
  useEscapeLayer(open, onClose)

  // Restore focus to the trigger when the menu closes (pick / Escape / outside click).
  useDropdownFocusRestore(resolveFocusTarget, open)

  return { menuRef, openUp, maxHeight, rect }
}
