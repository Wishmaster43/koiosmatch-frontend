/**
 * notify — app-wide toast, decoupled via a window event so any component (or a
 * promise .catch) can surface a result without prop-drilling. Rendered once by
 * <Toaster> mounted in App. Use notifyError on a failed mutation so a save never
 * fails silently (§3 — always handle the error state; AVG: no silent data loss).
 */
export type ToastType = 'error' | 'success' | 'info'

export function notify(type: ToastType, message: string) {
  window.dispatchEvent(new CustomEvent('km:toast', { detail: { type, message } }))
}

export const notifyError   = (message: string) => notify('error', message)
export const notifySuccess = (message: string) => notify('success', message)
