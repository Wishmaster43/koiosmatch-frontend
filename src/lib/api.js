import axios from 'axios'

/**
 * api — the single shared axios instance for the whole app.
 *
 * Every component imports this instead of calling fetch/axios directly, so that
 * auth + tenant headers, timeouts, 401 handling and rate-limit backoff all live
 * in ONE place (the interceptors below).
 *
 * baseURL comes from the VITE_API_URL env var (see .env). Always use https in
 * production — over http the token + data travel unencrypted.
 *
 * timeout is a safety net against the backend's synchronous, occasionally
 * long-running operations (sync/workflows): a hung request becomes a catchable
 * error instead of a spinner that never resolves. It is generous on purpose so
 * realistic slow calls still succeed.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api',
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

/**
 * Request interceptor — attaches the saved auth token + active tenant.
 *
 * SECURITY (#1): X-Tenant is browser-controlled. The BACKEND must verify the
 * logged-in user may use that tenant (only super_admin may switch) and ignore
 * the header otherwise. SECURITY (#2): the token lives in localStorage and is
 * therefore readable by any JS on the page — an httpOnly cookie would be safer.
 */
api.interceptors.request.use((config) => {
  const token  = localStorage.getItem('auth_token')
  const tenant = localStorage.getItem('active_tenant')
  if (token)  config.headers.Authorization = `Bearer ${token}`
  if (tenant) config.headers['X-Tenant']   = tenant
  return config
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Response interceptor.
 * - 429: retry an idempotent GET once after the server's retry_after (capped),
 *   so a brief rate-limit surfaces as a small delay rather than a hard error.
 *   Mutating requests (POST/PUT/…) are never auto-retried — the caller decides.
 * - 401 (expired/invalid token): clear the session and signal the app to route
 *   to /login via a custom event — no full-page reload, so React unmounts
 *   cleanly and the login screen can show a "session expired" hint. Skipped for
 *   the auth endpoints, which surface their own errors inline.
 * - errors are logged in dev only, so payloads don't leak into prod consoles.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const config = error.config ?? {}
    const url    = config.url ?? ''
    const method = (config.method ?? 'get').toLowerCase()

    if (status === 429 && method === 'get' && !config._retried429) {
      const retryAfter = Number(
        error.response?.data?.retry_after ?? error.response?.headers?.['retry-after'] ?? 1,
      )
      const waitSecs = Math.min(Math.max(Number.isFinite(retryAfter) ? retryAfter : 1, 1), 10)
      config._retried429 = true
      await sleep(waitSecs * 1000)
      return api(config)
    }

    // A 403 on /tenants is expected for non-super-admins — don't log it as an error.
    const benignTenants403 = status === 403 && url.includes('/tenants')
    if (import.meta.env.DEV && !benignTenants403) {
      console.error('API Error:', status, error.response?.data)
    }

    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/me')
    if (status === 401 && !isAuthCall) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      localStorage.removeItem('active_tenant')
      localStorage.removeItem('accessible_pages')
      if (window.location.pathname !== '/login') {
        sessionStorage.setItem('kc_session_expired', '1')
        window.dispatchEvent(new CustomEvent('kc:auth-expired'))
      }
    }
    return Promise.reject(error)
  },
)

export default api

// ── Response adapters ────────────────────────────────────────────────────────
// The API speaks three dialects; these helpers normalise all of them so call
// sites never have to re-guess the shape (the #1 source of hidden bugs):
//   1. { data, meta }                                      — API Resources
//   2. bare object / bare array                            — response()->json($model)
//   3. { data, total, per_page, current_page, last_page }  — custom /reports paginatie

/** Unwrap a single resource to its payload (handles { data } or a bare object). */
export function unwrap(res) {
  const body = res?.data ?? res
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) return body.data
  return body
}

/**
 * Unwrap any list response into a stable, predictable shape.
 * @returns {{ rows: any[], total: number, page: number, lastPage: number, perPage: number }}
 */
export function unwrapList(res) {
  const body = res?.data ?? res
  if (Array.isArray(body)) {
    return { rows: body, total: body.length, page: 1, lastPage: 1, perPage: body.length }
  }
  const rows = Array.isArray(body?.data) ? body.data : []
  const meta = body?.meta ?? body ?? {}
  return {
    rows,
    total:    meta.total        ?? rows.length,
    page:     meta.current_page ?? 1,
    lastPage: meta.last_page    ?? 1,
    perPage:  meta.per_page     ?? rows.length,
  }
}
