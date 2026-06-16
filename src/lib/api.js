import axios from 'axios'

/**
 * api — the single shared axios instance for the whole app.
 *
 * Every component imports this instead of calling fetch/axios directly, so that
 * auth and tenant headers are attached in ONE place (the interceptor below).
 *
 * FIXED (#3): baseURL now comes from the VITE_API_URL env var (see .env), so
 * production can point at an https endpoint. Falls back to the local dev URL.
 * Always use https in production — over http the token + data travel unencrypted.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

/**
 * Request interceptor — runs before every outgoing request.
 * Reads the saved auth token and the active tenant from localStorage and
 * attaches them as headers so each request is authenticated + tenant-scoped.
 *
 * SECURITY (#1, CRITICAL): the X-Tenant value is fully controlled by the browser.
 * A normal user can overwrite 'active_tenant' in localStorage to request another
 * tenant's data. The BACKEND must verify the logged-in user is allowed to use
 * that tenant (only super_admin may switch freely) and ignore the header otherwise.
 *
 * SECURITY (#2): storing the token in localStorage makes it readable by any JS
 * on the page (XSS / compromised dependency). An httpOnly cookie is safer.
 */
api.interceptors.request.use((config) => {
  const token  = localStorage.getItem('auth_token')
  const tenant = localStorage.getItem('active_tenant')
  if (token)  config.headers.Authorization = `Bearer ${token}`
  if (tenant) config.headers['X-Tenant']   = tenant
  return config
})

/**
 * Response interceptor — runs on every response.
 * Successful responses pass straight through; errors are logged and re-thrown
 * so the calling component can handle them.
 *
 * FIXED (#9): error responses are only logged in dev, so payloads don't leak
 * into the console in production.
 *
 * FIXED (#4): a real 401 (expired/invalid token) now clears the session and
 * sends the user to /login. We skip this for the auth endpoints themselves —
 * a failed /auth/login shows its error inline on LoginPage, and a startup
 * /auth/me 401 is already handled by AuthContext via the router.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url    = error.config?.url ?? ''

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
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
