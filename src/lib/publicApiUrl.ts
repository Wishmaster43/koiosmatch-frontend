/**
 * publicApiUrl — composes externally shareable ABSOLUTE URLs for API paths.
 * The cookie/proxy setup ships a RELATIVE VITE_API_URL (`/api`), which is right
 * for the axios client but wrong on every "copy this URL into an external
 * dashboard" surface (Meta callback, Facebook Leads, job-board feeds): a pasted
 * `/api/…` path is unreachable outside the app. A relative base therefore
 * resolves against the app's own origin, which is where that proxy path lives.
 */
const RAW_BASE = import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api'

/** The absolute API base for shareable URLs (explicit base overridable for tests). */
export function publicApiBase(raw: string = RAW_BASE): string {
  const trimmed = raw.replace(/\/$/, '')
  return /^https?:\/\//i.test(trimmed) ? trimmed : `${window.location.origin}${trimmed}`
}

/** Absolute URL for one API path (leading slash), e.g. publicApiUrl('/whatsapp/webhook'). */
export function publicApiUrl(path: string): string {
  return `${publicApiBase()}${path}`
}
