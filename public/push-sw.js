// push-sw.js — minimal, dependency-free service worker for web push (P11-FASE5).
// Scope: show the browser notification the server queued, and focus/open the
// app on click. Contains no framework code so it can be served as a plain
// static file and registered directly from src/lib/pushSubscription.ts.

// Show the payload the backend sent: { title, body, data: { type } } (see
// CONTRACT-CHANGELOG P11-FASE5) — same AVG-lean content as the phone bell.
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { payload = { title: event.data.text() } }
  const title = payload.title || 'Koios Match'
  const options = {
    body: payload.body || '',
    data: payload.data || {},
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Clicking the notification focuses an already-open app window on the payload's
// deep link when present (NOTIF-PAYLOAD, data.url — same hash target the in-app
// bell/toast use), or opens a new window there; falls back to '/' otherwise.
// ONIX M-001: resolve the click target and use it ONLY when it is on our own origin;
// anything else (foreign host, javascript:, malformed) falls back to '/'. The hash
// deep link survives because the full href is returned.
function sameOriginTarget(raw, origin) {
  try {
    const target = new URL(raw, origin)
    return target.origin === origin ? target.href : '/'
  } catch {
    return '/'
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = sameOriginTarget((event.notification.data && event.notification.data.url) || '/', self.location.origin)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url).catch(() => {})
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
      return undefined
    })
  )
})
