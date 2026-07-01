import { useEffect, useRef } from 'react'

/**
 * useFocusTrap — accessible dialog behaviour for an overlay (§6, WCAG 2.2 AA):
 * moves focus into the panel on open, traps Tab within it, closes on Escape, and
 * restores focus to the previously focused element on close. Attach the returned
 * ref to the dialog panel and add `role="dialog" aria-modal="true"` + an
 * aria-label, plus `tabIndex={-1}` so the panel itself can receive focus.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(onClose?: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    const SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(SELECTOR)).filter(el => el.offsetParent !== null)

    // Move focus into the panel on open (fall back to the panel itself).
    ;(focusables()[0] ?? node).focus({ preventScroll: true })

    // Trap Tab inside the panel; Escape closes.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) { e.preventDefault(); return }
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [onClose])
  return ref
}
