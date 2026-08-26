/**
 * notify — app-wide toast, decoupled via a window event so any component (or a
 * promise .catch) can surface a result without prop-drilling. Rendered once by
 * <Toaster> mounted in App. Use notifyError on a failed mutation so a save never
 * fails silently (§3 — always handle the error state; AVG: no silent data loss).
 *
 * NOTIF-ATTENTION-V1: `notify` additionally accepts an options object as its
 * (optional) third argument for "attention" toasts (new-notification popdowns) —
 * a title, an in-app `onOpen` click handler, a `deepLink` for the trailing
 * new-tab icon, and a longer `duration`. Purely additive: every existing
 * two-arg call (`notify('error', 'x')`) is unchanged.
 */
export type ToastType = 'error' | 'success' | 'info'

export interface ToastOptions {
  title?: string
  onOpen?: () => void
  deepLink?: string
  duration?: number
  // NOTIF-PAYLOAD: an optional calm status line (workflow-run action_status +
  // next_action), rendered under the message when set.
  actionLine?: string
}

// Fires a decoupled toast event (see file docblock above) — <Toaster> is the
// only listener, so any component can surface a result with no prop-drilling.
export function notify(type: ToastType, message: string, options?: ToastOptions) {
  window.dispatchEvent(new CustomEvent('km:toast', { detail: { type, message, ...options } }))
}

export const notifyError   = (message: string) => notify('error', message)
export const notifySuccess = (message: string) => notify('success', message)
