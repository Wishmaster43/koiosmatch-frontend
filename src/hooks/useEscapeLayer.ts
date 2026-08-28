/**
 * useEscapeLayer — the ONE layered-Escape mechanism (TRIAGE-3.3, Danny GO 28-08).
 * Problem it replaces: ~20 components each owned a window/element keydown
 * listener for Escape, so stacked overlays (dropdown inside modal inside
 * drawer) all closed at once, or in registration order — never top-first.
 * Model: a module-scope stack of active layers + ONE window listener in the
 * capture phase. Escape closes ONLY the top layer and stops the event there;
 * the next Escape reaches the next layer. Components keep their own handling
 * of every OTHER key (arrows, enter, tab) — this hook owns Escape alone.
 */
import { useEffect, useRef } from 'react'

type Layer = { onClose: () => void }

// Module-scope stack — top of the stack is the most recently opened overlay.
const stack: Layer[] = []

// The single window listener: capture phase so it wins from per-component
// bubble listeners during the migration window; removed when the stack empties.
let listening = false
function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || stack.length === 0) return
  // Only the TOP layer closes; the event dies here so layers beneath (and any
  // leftover legacy listeners) never see this press. stopImmediatePropagation
  // also silences OTHER window-level listeners (same target, capture or bubble);
  // stopPropagation alone only stops descendants.
  e.stopImmediatePropagation()
  e.stopPropagation()
  e.preventDefault()
  stack[stack.length - 1].onClose()
}
function ensureListener() {
  if (!listening) { window.addEventListener('keydown', onKeyDown, true); listening = true }
}
function dropListenerIfIdle() {
  if (listening && stack.length === 0) { window.removeEventListener('keydown', onKeyDown, true); listening = false }
}

/**
 * Imperative core: push a layer, get back its pop. For non-React lifecycles
 * (useFocusTrap arms on node-attach inside a ref setter, not in an effect).
 */
export function pushEscapeLayer(onClose: () => void): () => void {
  const layer: Layer = { onClose }
  stack.push(layer)
  ensureListener()
  return () => {
    // Pop THIS layer wherever it sits (outer overlays can unmount under inner ones).
    const i = stack.indexOf(layer)
    if (i !== -1) stack.splice(i, 1)
    dropListenerIfIdle()
  }
}

/**
 * Register this overlay as an escape layer while `active` is true.
 * `onClose` is called when Escape fires with this layer on top.
 */
export function useEscapeLayer(active: boolean, onClose: () => void) {
  // Keep the latest close callback without re-registering the layer each render
  // (assigned in an effect — writing a ref during render trips react-hooks/refs).
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!active) return
    return pushEscapeLayer(() => closeRef.current())
  }, [active])
}

// Test-only escape hatch to assert stack hygiene (never used in app code).
export function __escapeLayerCount() { return stack.length }
