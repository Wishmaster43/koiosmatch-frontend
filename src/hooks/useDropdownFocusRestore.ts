/**
 * useDropdownFocusRestore — shared focus-restoration logic for dropdown triggers
 * (CreatableSelect, SearchSelect, SelectMenu). When the dropdown closes (pick,
 * Escape, outside click), restores focus to the trigger unless another element
 * already claimed it — so the user's context stays with the trigger, not lost
 * on the document body.
 *
 * Takes a RESOLVER, not a bare ref: CreatableSelect/SelectMenu have one stable
 * `triggerRef` button to focus, but SearchSelect's trigger can be a caller-supplied
 * `renderTrigger` with no exposed ref, so it resolves the first focusable element
 * inside its container instead. A resolver covers both without a second hook.
 */
import { useEffect, useRef } from 'react'

// Shared focus-restoration hook for dropdown triggers. Takes a function that
// resolves the element to focus and an open state; restores focus to that
// element when closing, unless another element already claimed focus.
export function useDropdownFocusRestore(
  getFocusTarget: () => HTMLElement | null,
  open: boolean
) {
  const wasOpenRef = useRef(false)
  // Callers pass a fresh arrow every render; keep the latest in a ref so the
  // restore effect runs on open/close transitions only.
  const getFocusTargetRef = useRef(getFocusTarget)
  useEffect(() => { getFocusTargetRef.current = getFocusTarget })
  useEffect(() => {
    if (wasOpenRef.current && !open && (document.activeElement === document.body || document.activeElement == null)) {
      getFocusTargetRef.current()?.focus()
    }
    wasOpenRef.current = open
  }, [open])
}
