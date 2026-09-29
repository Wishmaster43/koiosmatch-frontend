/**
 * notificationText — NOTIF-I18N-1: resolves a notification row's title/body in
 * the VIEWING USER's language, never the tenant's stored (bureau-language)
 * literal. The backend stamps `title_key`/`body_key` as the full lang-catalogue
 * path it used server-side (e.g. "notifications.candidate.phase_stale.title" —
 * NotificationText::catalogueKeys()); the first path segment IS the i18next
 * namespace ("notifications", mirrored key-for-key in
 * `src/i18n/locales/<lng>/notifications.json`), the remainder is the key inside
 * it. A row with no key (free-typed by a workflow step, or a key the FE locale
 * does not (yet) carry) falls back to the server's own `title`/`body` text —
 * never a blank, never a guessed key.
 */
import i18n from '@/i18n'
import type { AppNotification } from '@/hooks/useNotifications'

export type TFunction = (key: string, opts?: Record<string, unknown>) => string

// Splits a server catalogue key ("notifications.candidate.phase_stale.title")
// into its i18next namespace (first segment) and the rest of the key path.
function splitCatalogueKey(key: string): { ns: string; path: string } | null {
  const dot = key.indexOf('.')
  if (dot === -1 || dot === key.length - 1) return null
  return { ns: key.slice(0, dot), path: key.slice(dot + 1) }
}

// One title/body half: translate via the split key when it exists in the
// user's active locale, else the server's own literal (bureau-language, but
// never blank).
function resolveHalf(key: string | null | undefined, serverText: string | undefined, params: Record<string, unknown> | undefined, t: TFunction): string {
  if (!key) return serverText ?? ''
  const parsed = splitCatalogueKey(key)
  if (!parsed) return serverText ?? ''
  const opts = { ns: parsed.ns, ...(params ?? {}) }
  if (!i18n.exists(parsed.path, opts)) return serverText ?? ''
  return t(parsed.path, opts)
}

// The row's title/body, resolved to the viewing user's language.
export function notificationText(n: AppNotification, t: TFunction): { title: string; body: string } {
  return {
    title: resolveHalf(n.title_key, n.title, n.params, t),
    body: resolveHalf(n.body_key, n.body, n.params, t),
  }
}
