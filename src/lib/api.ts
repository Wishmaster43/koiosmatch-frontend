import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { ListResult, PaginationMeta } from '../types/api'
import { COOKIE_AUTH, CSRF_COOKIE_URL } from './authMode'

/**
 * api — the single shared axios instance for the whole app.
 *
 * Every component imports this instead of calling fetch/axios directly, so that
 * auth + tenant headers, timeouts, 401 handling and rate-limit backoff all live
 * in ONE place (the interceptors below).
 *
 * baseURL comes from the VITE_API_URL env var (see .env) — it points at the API's
 * `/api` (== `/api/v1`, the same surface per the contract; a breaking change would
 * become `/api/v2`). Always use https in production — over http the token + data
 * travel unencrypted.
 *
 * timeout is a safety net against the backend's synchronous, occasionally
 * long-running operations (sync/workflows): a hung request becomes a catchable
 * error instead of a spinner that never resolves.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api',
  timeout: 120000,
  // Cookie auth: send the httpOnly auth cookie + auto-attach the CSRF token from
  // the XSRF-TOKEN cookie. Off by default so current CORS/Bearer flow is unchanged.
  withCredentials: COOKIE_AUTH,
  withXSRFToken: COOKIE_AUTH,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

/**
 * Prime the CSRF cookie before a state-changing auth call (login/logout).
 * No-op in Bearer mode. Uses a bare axios call because the CSRF endpoint lives
 * at the app root, not under the /api baseURL.
 */
export async function primeCsrf(): Promise<void> {
  if (!COOKIE_AUTH) return
  await axios.get(CSRF_COOKIE_URL, { withCredentials: true })
}

/**
 * Request interceptor — attaches the saved auth token + active tenant.
 *
 * SECURITY (#1): X-Tenant is browser-controlled. The BACKEND must verify the
 * logged-in user may use that tenant (only super_admin may switch) and ignore
 * the header otherwise. SECURITY (#2): the token lives in localStorage and is
 * therefore readable by any JS on the page — an httpOnly cookie would be safer.
 */
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token  = localStorage.getItem('auth_token')
  const tenant = localStorage.getItem('active_tenant')
  // In cookie mode the httpOnly cookie carries auth — never attach a Bearer header.
  if (!COOKIE_AUTH && token) config.headers.Authorization = `Bearer ${token}`
  if (tenant) config.headers['X-Tenant'] = tenant
  return config
})

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// axios doesn't know about our one-shot retry flag — extend the config type.
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried429?: boolean
}

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
  async (error: AxiosError<{ retry_after?: number; message?: string }>) => {
    // Aborted/cancelled requests (StrictMode double-effect, navigating away,
    // superseded fetches) are not real failures — skip logging + auth/retry logic.
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') return Promise.reject(error)

    const status = error.response?.status
    const config = (error.config ?? {}) as RetryableConfig
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
    // A 503 means an external integration isn't configured yet (HelloFlex, AI key):
    // an expected "not available yet", not a real error — keep it out of the dev log (CO7).
    const benignUnavailable = status === 503
    // Dev-only log of request CONTEXT only (status + method + url). NEVER log the
    // response body — a 4xx/5xx body can carry special-category data OR sensitive
    // backend detail (stack traces, paths). Inspect the body on demand in the
    // Network → Response tab instead (§8 / no secrets or PII in logs).
    // Redact record IDs (UUIDs + numeric path segments) so the dev log never
    // carries identifiers (§8: no PII/IDs in logs); the route shape stays useful.
    const safeUrl = url
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/\d+(?=\/|$|\?)/g, '/:id')
    if (import.meta.env.DEV && !benignTenants403 && !benignUnavailable) {
      console.error('API Error:', status, method.toUpperCase(), safeUrl)
    }

    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/me')
    if (status === 401 && !isAuthCall) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      localStorage.removeItem('active_tenant')
      localStorage.removeItem('accessible_pages')
      if (window.location.pathname !== '/login') {
        sessionStorage.setItem('km_session_expired', '1')
        window.dispatchEvent(new CustomEvent('km:auth-expired'))
      }
    }
    return Promise.reject(error)
  },
)

export default api

/**
 * isServiceUnavailable — true when an external integration isn't configured yet
 * (HelloFlex, AI key, …): the backend replies 503. Components should treat this as a
 * calm "not available yet" empty state, not a hard error (CO7 / FRONTEND-CONTRACT §1, §5).
 */
export function isServiceUnavailable(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 503
}

// ── Response adapters ────────────────────────────────────────────────────────
// The API speaks three dialects; these helpers normalise all of them so call
// sites never have to re-guess the shape (the #1 source of hidden bugs):
//   1. { data, meta }                                      — API Resources
//   2. bare object / bare array                            — response()->json($model)
//   3. { data, total, per_page, current_page, last_page }  — custom /reports paginatie

type ResponseLike = AxiosResponse | { data: unknown }

/** Unwrap a single resource to its payload (handles { data } or a bare object). */
export function unwrap<T = unknown>(res: ResponseLike): T {
  const body = (res as { data?: unknown })?.data ?? res
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return (body as { data: T }).data
  }
  return body as T
}

/** Unwrap any list response into a stable, predictable shape. */
export function unwrapList<T = unknown>(res: ResponseLike): ListResult<T> {
  const body = (res as { data?: unknown })?.data ?? res
  if (Array.isArray(body)) {
    return { rows: body as T[], total: body.length, page: 1, lastPage: 1, perPage: body.length }
  }
  const obj  = (body ?? {}) as { data?: unknown; meta?: PaginationMeta } & PaginationMeta
  const rows = Array.isArray(obj.data) ? (obj.data as T[]) : []
  const meta = obj.meta ?? obj
  return {
    rows,
    total:    meta.total        ?? rows.length,
    page:     meta.current_page ?? 1,
    lastPage: meta.last_page    ?? 1,
    perPage:  meta.per_page     ?? rows.length,
  }
}
