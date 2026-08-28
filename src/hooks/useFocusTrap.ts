/**
 * useFocusTrap — accessible dialog behaviour for an overlay (§6, WCAG 2.2 AA):
 * moves focus into the panel on open, traps Tab within it, closes on Escape, and
 * restores focus to the previously focused element on close. Attach the returned
 * ref to the dialog panel and add `role="dialog" aria-modal="true"` + an
 * aria-label, plus `tabIndex={-1}` so the panel itself can receive focus.
 *
 * ARMING SEMANTICS (K11b, 2026-08-13): the trap arms when the NODE ATTACHES to
 * the ref and disarms when it detaches — never on render cycles. Both earlier
 * shapes of this hook were wrong in opposite directions:
 *   - deps [onClose] re-armed on every parent re-render (every keystroke in a
 *     controlled input), tearing down/rebuilding the trap and stealing focus
 *     mid-word — the "ik kan niet normaal typen" bug in every FloatingPanel form;
 *   - deps [] armed exactly once at mount, which silently DISARMED every consumer
 *     that calls the hook unconditionally but renders the trapped node later
 *     (DrawerFilterMenu, OrderDetailDrawer: `if (!open) return null`).
 * Binding arm/disarm to the node itself covers both: a late-mounted panel arms
 * the moment it appears, and re-renders with the same node are a no-op.
 *
 * The returned value is a real MutableRefObject (getter/setter `current`), so
 * both `ref={trapRef}` and manual `trapRef.current = node` (FloatingPanel's
 * merged ref) arm it.
 */
import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { handlePopupKeydown } from './popupCommands'
import { pushEscapeLayer } from './useEscapeLayer'

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(onClose?: () => void): MutableRefObject<T | null> {
  // Latest onClose in a ref so the armed trap never needs re-arming to see it.
  const onCloseRef = useRef(onClose)
  // Keeps the ref pointed at the latest onClose, so the already-armed trap picks up a changed callback without needing to be re-armed.
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // One stable ref-like object per hook instance; its `current` setter owns the
  // arm/disarm lifecycle. useState's lazy init keeps identity stable without
  // writing a ref during render (react-hooks/refs).
  const [trapRef] = useState<MutableRefObject<T | null>>(() => {
    let node: T | null = null
    let cleanup: (() => void) | null = null

    const SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

    // Arm the trap on one attached panel node; returns its teardown.
    const arm = (el: T) => {
      const previouslyFocused = document.activeElement as HTMLElement | null
      const focusables = () => Array.from(el.querySelectorAll<HTMLElement>(SELECTOR)).filter(x => x.offsetParent !== null)

      // Move focus into the panel on open (fall back to the panel itself).
      ;(focusables()[0] ?? el).focus({ preventScroll: true })

      // POP-UPS 3.2: Tab handling lives in the ONE shared shortcuts file
      // (hooks/popupCommands); ESCAPE goes through the ONE layered stack
      // (useEscapeLayer, TRIAGE-3.3) — the trap registers as a layer while
      // armed, so an open popup always outranks its host drawer.
      const onKeyDown = (e: KeyboardEvent) => {
        handlePopupKeydown(e, { focusables })
      }
      el.addEventListener('keydown', onKeyDown)
      const popLayer = pushEscapeLayer(() => onCloseRef.current?.())
      return () => {
        popLayer()
        el.removeEventListener('keydown', onKeyDown)
        previouslyFocused?.focus?.({ preventScroll: true })
      }
    }

    return {
      get current() { return node },
      set current(next: T | null) {
        // Same node (a plain re-render) = no-op: focus is never touched by renders.
        if (next === node) return
        cleanup?.()
        cleanup = null
        node = next
        if (next) cleanup = arm(next)
      },
    }
  })

  return trapRef
}
