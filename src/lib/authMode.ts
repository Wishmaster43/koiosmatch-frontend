/**
 * Auth mode switch — Bearer-token (legacy) vs httpOnly cookie (hardened).
 *
 * The current flow stores a Sanctum token in localStorage and sends it as a
 * Bearer header — readable by any JS on the page (XSS risk, see lib/api). The
 * hardened flow uses an httpOnly session cookie that JS cannot read, plus a
 * CSRF token (Laravel Sanctum SPA model).
 *
 * A cookie can ONLY be set by the backend, so this is a coordinated flip:
 *   1. Backend serves the CSRF cookie endpoint + sets the httpOnly auth cookie
 *      on login and accepts the cookie (stateful) on every request.
 *   2. Set VITE_COOKIE_AUTH here: both sides are live, so cookie is the DEFAULT.
 *
 * FAIL-SAFE default (audit H1, 2026-07-08): a missing/typo'd env var must never
 * silently fall back to the XSS-readable Bearer mode — only an explicit
 * VITE_COOKIE_AUTH=false (legacy escape hatch, remove with H3) selects Bearer.
 */
export const COOKIE_AUTH = import.meta.env.VITE_COOKIE_AUTH !== 'false'

/**
 * Endpoint that sets the CSRF cookie (Laravel Sanctum default: GET
 * /sanctum/csrf-cookie at the app root, NOT under /api). Override with
 * VITE_CSRF_URL; otherwise derived from VITE_API_URL by dropping the /api suffix.
 */
export const CSRF_COOKIE_URL =
  import.meta.env.VITE_CSRF_URL ??
  `${(import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api').replace(/\/api\/?$/, '')}/sanctum/csrf-cookie`
