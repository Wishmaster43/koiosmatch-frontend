/**
 * pushSubscription — web-push client for P11-FASE5, on the BE contract in
 * koiosmatch-api/docs/contract/CONTRACT-CHANGELOG.md (2026-08-13, "P11-FASE5
 * web-push"): GET /push/vapid-key -> { key }, POST/DELETE /push/subscriptions
 * with { endpoint, keys: { p256dh, auth } } / { endpoint }. Auth-only, no
 * user param — the server scopes everything to the caller (no IDOR surface).
 * Subscribing itself IS the opt-in server-side; there is no separate setting key.
 */
import api, { unwrap } from './api'

// Feature-detection: every API this flow needs must exist before we offer the toggle.
export const isSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

// Current browser permission state ('default' | 'granted' | 'denied'), or null
// when the Notification API itself is unsupported (older Safari/Firefox).
export const permissionState = (): NotificationPermission | null =>
  isSupported() ? Notification.permission : null

// VAPID keys are base64url; PushManager.subscribe needs a raw Uint8Array.
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

// Registers the SW once (idempotent — the browser reuses an existing registration
// for the same scope/script URL).
async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/push-sw.js')
}

// Serialises a browser PushSubscription into the exact body shape the API expects.
function toSubscriptionBody(sub: PushSubscription): { endpoint: string; keys: { p256dh: string; auth: string } } {
  const json = sub.toJSON()
  return { endpoint: json.endpoint as string, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } }
}

/**
 * Requests permission, subscribes with PushManager using the tenant's VAPID
 * key, and POSTs the subscription. Throws on any failure step (permission
 * denied, subscribe rejected, POST failure) so the caller can roll the toggle back.
 */
export async function subscribe(): Promise<void> {
  if (!isSupported()) throw new Error('push_unsupported')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('push_permission_denied')

  const registration = await registerServiceWorker()
  const { key } = unwrap<{ key: string }>(await api.get('/push/vapid-key'))
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  })
  await api.post('/push/subscriptions', toSubscriptionBody(subscription))
}

/**
 * Unsubscribes the current browser subscription and DELETEs it server-side.
 * Best-effort by design: callers (toggle-off, logout) should catch failures
 * rather than block the user on a push cleanup call.
 */
export async function unsubscribe(): Promise<void> {
  if (!isSupported()) return
  const registration = await navigator.serviceWorker.getRegistration('/push-sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  const { endpoint } = toSubscriptionBody(subscription)
  await subscription.unsubscribe()
  await api.delete('/push/subscriptions', { data: { endpoint } })
}

// Reports whether the browser currently holds an active push subscription —
// used to initialise the settings toggle without a separate server flag.
export async function isSubscribed(): Promise<boolean> {
  if (!isSupported()) return false
  const registration = await navigator.serviceWorker.getRegistration('/push-sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  return !!subscription
}
