import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,          setUser]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [tenants,       setTenants]       = useState([])
  const [activeTenant,  setActiveTenantState] = useState(null)

  const setActiveTenant = (tenant) => {
    localStorage.setItem('active_tenant', tenant.id)
    setActiveTenantState(tenant)
  }

  // ── Startup: herstel sessie ──────────────────────────────────────────────────
  useEffect(() => {
    const token      = localStorage.getItem('auth_token')
    const saved      = localStorage.getItem('auth_user')
    const savedTenant = localStorage.getItem('active_tenant')

    if (token && saved) {
      setUser(JSON.parse(saved))
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_user')
          localStorage.removeItem('active_tenant')
          setUser(null)
        })
        .finally(() => setLoading(false))

      // Tenants ophalen voor super admin
      api.get('/tenants')
        .then(res => {
          const list = res.data?.data ?? res.data ?? []
          if (Array.isArray(list)) {
            setTenants(list)
            const active = list.find(t => t.id === savedTenant) ?? list[0]
            if (active) setActiveTenantState(active)
          }
        })
        .catch(() => {})
    } else {
      setLoading(false)
    }
  }, [])

  // ── Login ────────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const res                    = await api.post('/auth/login', { email, password })
    const { token, user, tenant } = res.data

    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))

    setUser(user)

    if (tenant?.id) {
      // Gewone gebruiker — eigen tenant
      localStorage.setItem('active_tenant', tenant.id)
      setActiveTenantState(tenant)
      setTenants([tenant])
    } else {
      // Super admin — haal alle tenants op
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

    return user
  }

  // ── Logout ───────────────────────────────────────────────────────────────────
  const logout = async () => {
    try { await api.post('/auth/logout') } catch {}
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('active_tenant')
    setUser(null)
    setActiveTenantState(null)
    setTenants([])
  }

  const hasRole  = (role) => user?.roles?.some(r => r.name === role) ?? false
  const isAdmin  = ()     => hasRole('admin') || hasRole('super_admin')
  const isSuperAdmin = () => hasRole('super_admin')

  return (
    <AuthContext.Provider value={{
      user, loading,
      tenants, activeTenant, setActiveTenant,
      login, logout, hasRole, isAdmin, isSuperAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)