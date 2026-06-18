import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'
import { hasModule as tenantHasModule } from '../lib/modules'

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
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,          setUser]              = useState(null)
  const [loading,       setLoading]           = useState(true)
  const [tenants,       setTenants]           = useState([])
  const [activeTenant,  setActiveTenantState] = useState(null)
  // Pages the backend says this user may open (single source of truth for
  // gated pages — see lib/access.js). Seeded from cache to avoid flash on boot.
  const [accessiblePages, setAccessiblePages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('accessible_pages') ?? '[]') } catch { return [] }
  })

  /**
   * Applies an /auth/me or login response: stores user + accessible_pages.
   * Also updates activeTenant when the response includes one (non-super-admin
   * logins and /auth/me refreshes both carry the tenant with package + modules).
   * Returns the user object.
   */
  const applyAuthResponse = (data) => {
    const u     = data?.user ?? data?.data ?? data
    const pages = data?.accessible_pages ?? u?.accessible_pages ?? []
    setUser(u)
    localStorage.setItem('auth_user', JSON.stringify(u))
    setAccessiblePages(pages)
    localStorage.setItem('accessible_pages', JSON.stringify(pages))

    // If the response carries a tenant (non-super-admin or /auth/me), keep the
    // active tenant state in sync so tenant.package + tenant.modules stay fresh.
    const t = data?.tenant ?? u?.tenant
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
  const setActiveTenant = async (tenant) => {
    localStorage.setItem('active_tenant', tenant.id)
    setActiveTenantState(tenant)
    try {
      const res = await api.get('/auth/me')
      applyAuthResponse(res.data)
    } catch {}
  }

  // Decides whether we may call the super-admin-only /tenants endpoint.
  const userIsSuperAdmin = (u) => u?.is_super_admin === true

  /**
   * Populate the tenant list + active tenant based on the user's role.
   * - super_admin → load ALL tenants and select the saved/first one.
   * - regular user → use only their own tenant from /auth/me (never call /tenants).
   */
  const setupTenants = (u) => {
    const savedTenant = localStorage.getItem('active_tenant')
    if (userIsSuperAdmin(u)) {
      api.get('/tenants')
        .then(res => {
          const list = res.data?.data ?? res.data ?? []
          if (Array.isArray(list) && list.length) {
            setTenants(list)
            const active = list.find(t => t.id === savedTenant) ?? list[0]
            if (active) {
              setActiveTenantState(active)
              localStorage.setItem('active_tenant', active.id)
            }
          }
        })
        .catch(() => {})
    } else if (u?.tenant) {
      setTenants([u.tenant])
      setActiveTenantState(u.tenant)
      localStorage.setItem('active_tenant', u.tenant.id)
    }
  }

  // ── Session expiry (401) ─────────────────────────────────────────────────────
  // api.js fires 'kc:auth-expired' after a 401 (and has already cleared
  // localStorage). We clear React state here so ProtectedRoute routes to /login
  // within the SPA — no full-page reload, no lost router context.
  useEffect(() => {
    const onExpired = () => {
      setUser(null)
      setActiveTenantState(null)
      setTenants([])
      setAccessiblePages([])
    }
    window.addEventListener('kc:auth-expired', onExpired)
    return () => window.removeEventListener('kc:auth-expired', onExpired)
  }, [])

  // ── Startup: restore session from localStorage ───────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const saved = localStorage.getItem('auth_user')

    if (!token || !saved) {
      setLoading(false)
      return
    }

    try { setUser(JSON.parse(saved)) } catch {
      localStorage.removeItem('auth_user')
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
  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })

    // MFA step-up: backend returns { mfa_required: true, mfa_token } — no auth
    // token yet. Caller must show the TOTP screen then call verifyMfa().
    if (res.data?.mfa_required) {
      return { mfaRequired: true, mfaToken: res.data.mfa_token }
    }

    const { token, tenant } = res.data
    localStorage.setItem('auth_token', token)
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
  const verifyMfa = async (mfaToken, code) => {
    const res = await api.post('/auth/mfa/verify', { mfa_token: mfaToken, code })
    const { token, tenant } = res.data
    localStorage.setItem('auth_token', token)
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
      } catch {}
    }

    return u
  }

  // ── MFA management (called from Security settings tab) ───────────────────────
  /** Start MFA setup. Returns { secret, otpauth_url } — render otpauth_url as QR. */
  const setupMfa    = ()           => api.post('/auth/mfa/setup').then(r => r.data)
  /** Confirm MFA with the first TOTP code. Returns { recovery_codes: [...] }. */
  const confirmMfa  = (code)       => api.post('/auth/mfa/confirm', { code }).then(r => r.data)
  /** Disable MFA. Requires the current TOTP code for confirmation. */
  const disableMfa  = (code)       => api.post('/auth/mfa/disable', { code }).then(r => {
    // Keep mfa_enabled in sync without a full /auth/me reload.
    setUser(prev => prev ? { ...prev, mfa_enabled: false } : prev)
    return r.data
  })

  // ── Refresh the profile from the server ──────────────────────────────────────
  const refreshUser = async () => {
    const res = await api.get('/auth/me')
    return applyAuthResponse(res.data)
  }

  // ── Logout ────────────────────────────────────────────────────────────────────
  const logout = async () => {
    try { await api.post('/auth/logout') } catch {}
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('active_tenant')
    localStorage.removeItem('accessible_pages')
    setUser(null)
    setActiveTenantState(null)
    setTenants([])
    setAccessiblePages([])
  }

  // ── Role / permission helpers (UI gating only — NOT security) ────────────────

  const hasRole  = (role) => user?.roles?.some(r => (typeof r === 'string' ? r : r.name) === role) ?? false
  const isAdmin  = ()     => hasRole('admin') || hasRole('tenant_admin') || hasRole('super_admin')
  const isSuperAdmin = () => user?.is_super_admin === true

  // Capability check for paid add-on modules ('sm', 'hf', 'ai', 'ats', 'plan').
  // Used to gate SM nav/pages now that /sm/* is hard-gated server-side (403).
  const hasModule = (key) =>
    tenantHasModule(key, activeTenant ?? user?.tenant, { isSuperAdmin: isSuperAdmin() })

  const hasPermission = (permName) => {
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

  return (
    <AuthContext.Provider value={{
      user, loading, accessiblePages,
      tenants, activeTenant, setActiveTenant,
      login, logout, refreshUser,
      verifyMfa, setupMfa, confirmMfa, disableMfa,
      hasRole, hasPermission, isAdmin, isSuperAdmin, hasModule,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
