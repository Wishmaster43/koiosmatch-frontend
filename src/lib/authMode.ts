/**
 * Auth mode — httpOnly cookie + CSRF (Laravel Sanctum SPA model), the ONLY mode.
 *
 * The legacy Bearer-token flow (token in localStorage, readable by any JS on the
 * page) was REMOVED entirely on 2026-07-08 (audit H3): there is no code path that
 * writes a credential to localStorage anymore, and no env var can re-enable one.
 * The backend still supports token auth for API-key clients — that never touches
 * this SPA.
 */

/**
 * Endpoint that sets the CSRF cookie (Laravel Sanctum default: GET
 * /sanctum/csrf-cookie at the app root, NOT under /api). Override with
 * VITE_CSRF_URL; otherwise derived from VITE_API_URL by dropping the /api suffix.
 */
export const CSRF_COOKIE_URL =
  import.meta.env.VITE_CSRF_URL ??
  `${(import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api').replace(/\/api\/?$/, '')}/sanctum/csrf-cookie`
