import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import api, { primeCsrf } from '../lib/api'
import { hasModule as tenantHasModule } from '../lib/modules'
import { queryClient } from '../lib/queryClient'
import type { Tenant, User } from '../types/api'

/**
 * AuthContext — global authentication + tenant state.
 *
 * Holds the logged-in user, the list of tenants the user may access, and the
 * currently active tenant. Exposes login/logout plus role/permission helpers
 * that the rest of the app uses to show or hide UI.
 *
 * NOTE: every helper here only controls the UI. Real authorization MUST be
 * enforced by the backend on each endpoint — these checks are not security.
 */

// The auth user, plus the flat tenant_id the backend includes on the profile.
export type AuthUser = User & { tenant_id?: string | number | null }
type LoginResult = AuthUser | { mfaRequired: boolean; mfaToken: unknown }

export interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  accessiblePages: string[]
  tenants: Tenant[]
  activeTenant: Tenant | null
  setActiveTenant: (tenant: Tenant) => Promise<void>
  login: (email: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
  refreshUser: () => Promise<AuthUser>
  verifyMfa: (mfaToken: string, code: string) => Promise<AuthUser>
  setupMfa: () => Promise<unknown>
  confirmMfa: (code: string) => Promise<unknown>
  disableMfa: (code: string) => Promise<unknown>
  hasRole: (role: string) => boolean
  hasPermission: (permName: string) => boolean
  isAdmin: () => boolean
  isSuperAdmin: () => boolean
  hasModule: (key: string) => boolean
  dashboardType: () => string
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,          setUser]              = useState<AuthUser | null>(null)
  const [loading,       setLoading]           = useState(true)
  const [tenants,       setTenants]           = useState<Tenant[]>([])
  const [activeTenant,  setActiveTenantState] = useState<Tenant | null>(null)
  // Pages the backend says this user may open (single source of truth for
  // gated pages — see lib/access.js). Memory only: the cookie flow keeps
  // NOTHING auth-shaped in localStorage (D1; the Bearer flow was removed — H3).
  const [accessiblePages, setAccessiblePages] = useState<string[]>([])

  /**
   * Applies an /auth/me or login response: stores user + accessible_pages.
   * Also updates activeTenant when the response includes one. Returns the user.
   */
  const applyAuthResponse = (data: unknown): AuthUser => {
    const d = data as { user?: AuthUser; data?: AuthUser; accessible_pages?: string[]; tenant?: Tenant } | null | undefined
    const u     = (d?.user ?? d?.data ?? data) as AuthUser
    const pages = d?.accessible_pages ?? u?.accessible_pages ?? []
    setUser(u)
    setAccessiblePages(pages)
    // D1 (Danny 2026-07-04): the profile stays in MEMORY only — no user PII,
    // roles or pages in localStorage. A neutral flag is the "there was a
    // session" boot hint, so the login screen still shows zero 401s.
    localStorage.setItem('km_session', '1')

    // If the response carries a tenant (non-super-admin or /auth/me), keep the
    // active tenant state in sync so tenant.package + tenant.modules stay fresh.
    const t = d?.tenant ?? u?.tenant
    if (t?.id) {
      setActiveTenantState(prev => {
        // Only update if this response is for the currently active tenant
        // (super admins may have switched — don't overwrite their selection).
        if (!prev || prev.id === t.id) {
          localStorage.setItem('active_tenant', t.id)
          return t
        }
        return prev
      })
    }

    return u
  }

  /**
   * Switch the active tenant (used by super admins).
   * Persists the choice, then re-fetches /auth/me so roles/permissions/context
   * match the newly selected tenant.
   */
  const setActiveTenant = async (tenant: Tenant): Promise<void> => {
    localStorage.setItem('active_tenant', tenant.id)
    setActiveTenantState(tenant)
    queryClient.clear()
    // React Query is cleared above, but module-level caches (lookups, custom-fields, all-settings,
    // KPI) + context state survive a soft switch and would LEAK the previous tenant's data into the
    // newly selected bureau. Special-category health data (AVG) — isolation must be absolute, so we
    // hard-reload to re-bootstrap the whole app for the new tenant (X-Tenant already points at it).
    window.location.reload()
  }

  // Decides whether we may call the super-admin-only /tenants endpoint.
  const userIsSuperAdmin = (u?: AuthUser | null) => u?.is_super_admin === true

  /**
   * Populate the tenant list + active tenant based on the user's role.
   * - super_admin → load ALL tenants and select the saved/first one.
   * - regular user → use only their own tenant from /auth/me (never call /tenants).
   */
  const setupTenants = (u?: AuthUser | null) => {
    const savedTenant = localStorage.getItem('active_tenant')
    if (userIsSuperAdmin(u)) {
      api.get('/tenants')
        .then(res => {
          const list = res.data?.data ?? res.data ?? []
          if (Array.isArray(list) && list.length) {
            setTenants(list)
            const active = list.find((t: Tenant) => t.id === savedTenant) ?? list[0]
            if (active) {
              setActiveTenantState(active)
              localStorage.setItem('active_tenant', active.id)
            }
          }
        })
        .catch(() => {})
    } else {
      const tenant = u?.tenant
      if (tenant) {
        setTenants([tenant])
        setActiveTenantState(tenant)
        localStorage.setItem('active_tenant', tenant.id)
      }
    }
  }

  // ── Session expiry (401) ─────────────────────────────────────────────────────
  // api.js fires 'km:auth-expired' after a 401 (and has already cleared
  // localStorage). We clear React state here so ProtectedRoute routes to /login
  // within the SPA — no full-page reload, no lost router context.
  useEffect(() => {
    const onExpired = () => {
      setUser(null)
      setActiveTenantState(null)
      setTenants([])
      setAccessiblePages([])
    }
    window.addEventListener('km:auth-expired', onExpired)
    return () => window.removeEventListener('km:auth-expired', onExpired)
  }, [])

  // MFA enforcement mid-session (MFA-ENF): api.ts fires this on the first 403 with
  // code mfa_enrollment_required. Re-fetching /auth/me sets mfa_setup_required on
  // the user, which flips App.tsx's ProtectedRoute into the enrollment gate.
  useEffect(() => {
    const onMfaRequired = () => {
      api.get('/auth/me').then(res => applyAuthResponse(res.data)).catch(() => {})
    }
    window.addEventListener('km:mfa-enrollment-required', onMfaRequired)
    return () => window.removeEventListener('km:mfa-enrollment-required', onMfaRequired)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Startup: restore session ─────────────────────────────────────────────────
  // The httpOnly cookie is invisible to JS; the NEUTRAL km_session flag (never
  // the profile — D1 keeps PII out of localStorage) is the "there was a session"
  // hint — without it (first visit / after logout) skip the probe entirely, so
  // the login screen shows ZERO 401s.
  useEffect(() => {
    if (localStorage.getItem('km_session') !== '1') {
      setLoading(false)
      return
    }

    api.get('/auth/me')
      .then(res => {
        const u = applyAuthResponse(res.data)
        setupTenants(u)
      })
      .catch(() => {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        localStorage.removeItem('active_tenant')
        localStorage.removeItem('accessible_pages')
        localStorage.removeItem('km_session')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  // ── Login ────────────────────────────────────────────────────────────────────
  /**
   * Authenticates with email/password.
   *
   * Returns { mfaRequired: true, mfaToken } when the backend asks for a TOTP
   * code (MFA step-up), so LoginPage can show the code input without logging in.
   * Returns the user object on normal success.
   */
  const login = async (email: string, password: string): Promise<LoginResult> => {
    // Cookie mode: prime the CSRF cookie before the state-changing login POST.
    await primeCsrf()
    const res = await api.post('/auth/login', { email, password })

    // MFA step-up: backend returns { mfa_required: true, mfa_token } — no auth
    // token yet. Caller must show the TOTP screen then call verifyMfa().
    if (res.data?.mfa_required) {
      return { mfaRequired: true, mfaToken: res.data.mfa_token }
    }

    const { tenant } = res.data
    // The httpOnly session cookie carries auth — a body token is NEVER stored
    // (X-Auth-Mode makes the API send token:null; storing one would put an
    // XSS-readable credential in localStorage — Danny's 2026-07-04 catch, H3).
    const u = applyAuthResponse(res.data)

    if (tenant?.id) {
      localStorage.setItem('active_tenant', tenant.id)
      setActiveTenantState(tenant)
      setTenants([tenant])
    } else {
      try {
        const r    = await api.get('/tenants')
        const list = r.data?.data ?? r.data ?? []
        if (Array.isArray(list) && list.length > 0) {
          setTenants(list)
          const first = list[0]
          localStorage.setItem('active_tenant', first.id)
          setActiveTenantState(first)
        }
      } catch {
        localStorage.setItem('active_tenant', 'yesway')
      }
    }

    return u
  }

  // ── MFA step-up verify ───────────────────────────────────────────────────────
  /**
   * Completes MFA login. Called after login() returns { mfaRequired: true }.
   * mfaToken comes from the login response; code is the 6-digit TOTP.
   * On success stores the session and resolves to the user object (same as login).
   */
  const verifyMfa = async (mfaToken: string, code: string): Promise<AuthUser> => {
    const res = await api.post('/auth/mfa/verify', { mfa_token: mfaToken, code })
    const { tenant } = res.data
    // Same rule as login(): a body token is never stored (see above, H3).
    const u = applyAuthResponse(res.data)

    if (tenant?.id) {
      localStorage.setItem('active_tenant', tenant.id)
      setActiveTenantState(tenant)
      setTenants([tenant])
    } else {
      try {
        const r    = await api.get('/tenants')
        const list = r.data?.data ?? r.data ?? []
        if (Array.isArray(list) && list.length > 0) {
          setTenants(list)
          const first = list[0]
          localStorage.setItem('active_tenant', first.id)
          setActiveTenantState(first)
        }
      } catch { /* fall through with no tenant list */ }
    }

    return u
  }

  // ── MFA management (called from Security settings tab) ───────────────────────
  /** Start MFA setup. Returns { secret, otpauth_url } — render otpauth_url as QR. */
  const setupMfa    = ()              => api.post('/auth/mfa/setup').then(r => r.data)
  /** Confirm MFA with the first TOTP code. Returns { recovery_codes: [...] }. */
  const confirmMfa  = (code: string)  => api.post('/auth/mfa/confirm', { code }).then(r => r.data)
  /** Disable MFA. Requires the current TOTP code for confirmation. */
  const disableMfa  = (code: string)  => api.post('/auth/mfa/disable', { code }).then(r => {
    // Keep mfa_enabled in sync without a full /auth/me reload.
    setUser(prev => prev ? { ...prev, mfa_enabled: false } : prev)
    return r.data
  })

  // ── Refresh the profile from the server ──────────────────────────────────────
  const refreshUser = async (): Promise<AuthUser> => {
    const res = await api.get('/auth/me')
    return applyAuthResponse(res.data)
  }

  // ── Logout ────────────────────────────────────────────────────────────────────
  const logout = async (): Promise<void> => {
    try { await api.post('/auth/logout') } catch { /* clear local state regardless */ }
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('active_tenant')
    localStorage.removeItem('accessible_pages')
    localStorage.removeItem('km_session')
    // Allow the MFA-gate signal to fire again in a fresh session (see api.ts).
    sessionStorage.removeItem('km_mfa_gate')
    setUser(null)
    setActiveTenantState(null)
    setTenants([])
    setAccessiblePages([])
  }

  // ── Role / permission helpers (UI gating only — NOT security) ────────────────

  const hasRole  = (role: string) => user?.roles?.some(r => (typeof r === 'string' ? r : r.name) === role) ?? false
  const isAdmin  = ()     => hasRole('admin') || hasRole('tenant_admin') || hasRole('super_admin')
  // Super admin = explicit flag, the super_admin role, or a user without a tenant.
  const isSuperAdmin = () => user?.is_super_admin === true || hasRole('super_admin') || (!!user && user.tenant_id == null && !user.tenant)

  // Capability check for paid add-on modules ('sm', 'hf', 'ai', 'ats', 'plan').
  // Module gating is uniform: an off module is unprovisioned for the tenant, so it stays
  // hidden for EVERYONE incl. super-admins (Danny 2026-07-02) — mirrors lib/access.ts. The
  // server still 403s the endpoints. No isSuperAdmin bypass here on purpose.
  const hasModule = (key: string) =>
    tenantHasModule(key, activeTenant ?? user?.tenant)

  // Start-dashboard type from the first role that carries one (C-35). The shape is
  // live (roles are objects), but the seeded dashboard_type values read null until a
  // dev:reset — so we default to 'readonly' (least privilege). Still tolerant of the
  // legacy string[] shape defensively (untrusted client, §7).
  const dashboardType = (): string => {
    for (const r of user?.roles ?? []) {
      if (typeof r === 'object' && r.dashboard_type) return r.dashboard_type
    }
    return 'readonly'
  }

  const hasPermission = (permName: string) => {
    if (!user) return false
    if (isSuperAdmin()) return true

    if (Array.isArray(user.permissions)) {
      return user.permissions.some(p => (typeof p === 'string' ? p : p.name) === permName)
    }

    const roles = user.roles ?? []
    for (const r of roles) {
      if (typeof r === 'object' && Array.isArray(r.permissions)) {
        if (r.permissions.some(p => (typeof p === 'string' ? p : p.name) === permName)) return true
      }
    }

    if (permName.endsWith('.sync') || permName.endsWith('.refresh')) {
      return hasRole('tenant_admin') || hasRole('planner')
    }
    return false
  }

  const value: AuthContextValue = {
    user, loading, accessiblePages,
    tenants, activeTenant, setActiveTenant,
    login, logout, refreshUser,
    verifyMfa, setupMfa, confirmMfa, disableMfa,
    hasRole, hasPermission, isAdmin, isSuperAdmin, hasModule, dashboardType,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue | null {
  return useContext(AuthContext)
}
