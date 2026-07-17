import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { ListResult, PaginationMeta } from '../types/api'
import { CSRF_COOKIE_URL } from './authMode'
import { isMfaEnrollmentError } from './mfaGate'
import { notifyError } from './notify'

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
  // Default timeout: 20s (C-CHIP #5). Known long-running paths get 120s via the
  // request interceptor below — a hung CRUD call should fail fast, a sync/report
  // may legitimately take a while.
  timeout: 20000,
  // Cookie auth (the only mode — H3): send the httpOnly auth cookie and
  // auto-attach the CSRF token from the XSRF-TOKEN cookie on every request.
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: {
    // No fixed Content-Type here: axios sets application/json for plain objects
    // AND multipart/form-data (with boundary) for FormData automatically. A
    // hardcoded json default broke every file upload (logo 422 "field required",
    // CMBE hotfix 14-07 — see COORDINATION-LOG).
    'Accept': 'application/json',
  },
})

/**
 * Prime the CSRF cookie before a state-changing auth call (login/logout).
 * Uses a bare axios call because the CSRF endpoint lives at the app root,
 * not under the /api baseURL.
 */
export async function primeCsrf(): Promise<void> {
  await axios.get(CSRF_COOKIE_URL, { withCredentials: true })
}

// D1/H3: a LEGACY bearer token left behind by the removed Bearer flow is a live
// XSS-readable credential (it may still be valid server-side) — purge it at boot.
// The cached profile/pages were PII in localStorage (Danny 2026-07-04) — purge too;
// the profile lives in memory only (km_session is the neutral hint). Also swept:
// auth-shaped keys from OLDER apps that shared this origin (localhost dev port).
for (const key of ['auth_token', 'auth_user', 'accessible_pages', 'token', 'user', 'yesway_admin_token']) {
  localStorage.removeItem(key)
}

/**
 * Request interceptor — attaches the auth-mode + active-tenant headers.
 *
 * SECURITY: X-Tenant is browser-controlled. The BACKEND must verify the
 * logged-in user may use that tenant (only super_admin may switch) and ignore
 * the header otherwise. Auth itself rides the httpOnly cookie — no Authorization
 * header exists anymore (H3).
 */
// Long-running endpoints (sync jobs, reports/aggregations, workflow runs, AI,
// uploads) keep the old 120s safety net; everything else fails fast at 20s.
const SLOW_PATHS = /\/(sm_reports|sm_sync|reports|workflows\/[^/]+\/(run|execute)|ai\/|exports?|imports?|documents|avatar)/

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tenant = localStorage.getItem('active_tenant')
  // X-Auth-Mode tells the backend to return token:null on login (no bearer
  // credential over the wire at all — D1 aftercare, agreed with BE 2026-07-04).
  config.headers['X-Auth-Mode'] = 'cookie'
  if (tenant) config.headers['X-Tenant'] = tenant
  // Timeout differentiation (C-CHIP #5) — only when the caller didn't set one.
  if (config.timeout === 20000 && SLOW_PATHS.test(config.url ?? '')) config.timeout = 120000
  return config
})

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// axios doesn't know about our one-shot retry flag — extend the config type.
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried429?: boolean
  _retried419?: boolean
  // Opt-in per request: a 404 on an OPTIONAL endpoint (a lookup the backend hasn't
  // shipped yet; the caller has a seed fallback) is expected — keep it out of the
  // dev log so it doesn't read as (or turn the smoke suite) red.
  quiet404?: boolean
  // Opt-in per request: these statuses are EXPECTED, caller-handled outcomes (e.g.
  // the workflow run-start 409 "already running" gets its own inline feedback) —
  // suppress the generic dev error-toast for them, keep everything else intact.
  quietStatuses?: number[]
}

// Callers pass { quiet404: true } / { quietStatuses: [409] } — teach axios' config the flags.
declare module 'axios' {
  export interface AxiosRequestConfig {
    quiet404?: boolean
    quietStatuses?: number[]
  }
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

    // 419 = Sanctum rejected the CSRF token BEFORE processing (expired/rotated
    // cookie after a long-idle tab) — the request never executed, so one retry
    // after re-priming the cookie is safe for every method (audit LOW item).
    if (status === 419 && !config._retried419) {
      config._retried419 = true
      try {
        await primeCsrf()
        return api(config)
      } catch { /* cookie refresh failed — fall through to normal error handling */ }
    }

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
    // Caller-declared optional endpoint (seed fallback in place) — expected 404.
    const benignOptional404 = status === 404 && Boolean(config.quiet404)
    // Dev-only log of request CONTEXT only (status + method + url). NEVER log the
    // response body — a 4xx/5xx body can carry special-category data OR sensitive
    // backend detail (stack traces, paths). Inspect the body on demand in the
    // Network → Response tab instead (§8 / no secrets or PII in logs).
    // Redact record IDs (UUIDs + numeric path segments) so the dev log never
    // carries identifiers (§8: no PII/IDs in logs); the route shape stays useful.
    const safeUrl = url
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\/\d+(?=\/|$|\?)/g, '/:id')
    // 401 = auth state (pre-login boot calls / expired session), handled centrally by
    // the redirect below — logging each one only alarms whoever reads the console.
    if (import.meta.env.DEV && status !== 401 && !benignTenants403 && !benignUnavailable && !benignOptional404) {
      console.error('API Error:', status, method.toUpperCase(), safeUrl)
    }

    // A-7: surface silent write-failures in dev. A failed mutation otherwise vanishes
    // into a component's `.catch` — a dev toast makes a broken/missing/500 endpoint
    // visible (this is why saves "silently" don't persist). GET stays quiet (loads degrade).
    const callerHandled = Boolean(status && config.quietStatuses?.includes(status))
    if (import.meta.env.DEV && method !== 'get' && status && status !== 401 && !benignTenants403 && !benignUnavailable && !callerHandled) {
      notifyError(`API ${method.toUpperCase()} ${safeUrl} → ${status}`)
    }

    // MFA enforcement (MFA-ENF): a 403 with code mfa_enrollment_required means the
    // tenant admin flipped mfa.enforced while this user was logged in without MFA.
    // Signal AuthContext to refresh /auth/me so the enrollment gate takes over
    // immediately (instead of at the next boot). Once per session is enough.
    if (isMfaEnrollmentError(error) && !sessionStorage.getItem('km_mfa_gate')) {
      sessionStorage.setItem('km_mfa_gate', '1')
      window.dispatchEvent(new CustomEvent('km:mfa-enrollment-required'))
    }

    // AUTH-RETRY-STORM-1: a 401 on /auth/me is TERMINAL — purge the session flags
    // (km_session above all) so no later boot/refresh ever re-probes with a dead
    // token; a /auth/me-storm once filled the global rate bucket and locked the
    // login out. No redirect/event here: the boot path stays quiet by design and
    // AuthContext's catch owns the UI state.
    if (status === 401 && url.includes('/auth/me')) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      localStorage.removeItem('active_tenant')
      localStorage.removeItem('accessible_pages')
      localStorage.removeItem('km_session')
    }

    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/me')
    if (status === 401 && !isAuthCall) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      localStorage.removeItem('active_tenant')
      localStorage.removeItem('accessible_pages')
      localStorage.removeItem('km_session')
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
