/**
 * AuthContext — dashboardType() precedence (DASHBOARD-KIEZER-1 chain audit).
 *
 * dashboardType() used to return the FIRST role that carried a dashboard_type.
 * But /auth/me (backend AuthPayloadService) never sorts roles by precedence — it
 * just maps the user's roles in whatever order Eloquent returns them — so a user
 * holding BOTH 'recruitment' and 'recruitment_manager' could land on the poorer
 * own-scoped recruiter dashboard purely by DB row order, exactly backwards from
 * the intent of TYPE_PRECEDENCE ("the richest dashboard wins", templates.ts).
 * This now resolves through the SAME resolveDashboardType() the rest of the
 * dashboard-type chain (switcher/DashboardLayout) uses.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { AuthProvider, useAuth } from './AuthContext'
import { queryClient } from '@/lib/queryClient'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(async () => ({ data: {} })) } }
})

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

afterEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('AuthContext · dashboardType() precedence', () => {
  it('picks recruitment_manager over recruitment when a user holds both roles, regardless of list order', async () => {
    // The "there was a session" hint — without it the boot probe is skipped entirely.
    localStorage.setItem('km_session', '1')
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/auth/me') {
        return Promise.resolve({
          data: {
            user: {
              id: 'u1',
              // Deliberately lists the OWN-SCOPED role FIRST — "first role wins"
              // would (wrongly) resolve to 'recruitment' here.
              roles: [
                { name: 'recruiter', dashboard_type: 'recruitment' },
                { name: 'manager', dashboard_type: 'recruitment_manager' },
              ],
            },
          },
        })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current?.loading).toBe(false))
    expect(result.current?.dashboardType()).toBe('recruitment_manager')
  })

  it('falls back to readonly when the user carries no dashboard_type at all', async () => {
    localStorage.setItem('km_session', '1')
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: { user: { id: 'u2', roles: [] } } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current?.loading).toBe(false))
    expect(result.current?.dashboardType()).toBe('readonly')
  })
})

// AUDIT 03-09 frontend-security-quality-1 (CRITICAL): logging out must leave nothing of the
// previous user behind in this tab — React Query cache, the per-tenant app cache, storage —
// and must hard-reload so module-scope caches restart (mirrors setActiveTenant).
describe('AuthContext · logout leaves no cached data behind', () => {
  it('clears the query cache and the tenant-scoped storage keys, then reloads', async () => {
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } })
    const clearSpy = vi.spyOn(queryClient, 'clear')
    localStorage.setItem('enabled_apps', '["whatsapp"]')
    localStorage.setItem('active_tenant', 'demo')
    queryClient.setQueryData(['users', 'demo'], [{ id: 'u1', name: 'Vorige gebruiker' }])
    vi.mocked(api.get).mockResolvedValue({ data: { user: null } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current).not.toBeNull())
    await result.current!.logout()
    expect(clearSpy).toHaveBeenCalled()
    expect(queryClient.getQueryData(['users', 'demo'])).toBeUndefined()
    expect(localStorage.getItem('enabled_apps')).toBeNull()
    expect(localStorage.getItem('active_tenant')).toBeNull()
    expect(reload).toHaveBeenCalled()
    Object.defineProperty(window, 'location', { configurable: true, value: original })
  })
})

// AUDIT 04-09 frontend-security-quality-2 (191 react-query keys, 3 tenant-scoped): a
// super admin switching tenant must never keep the previous tenant's cached lists
// around while /auth/me for the new tenant is still in flight — the cache is cleared
// BEFORE the reload re-bootstraps the app for the newly selected tenant.
describe('AuthContext · setActiveTenant clears the query cache before reloading', () => {
  it('calls queryClient.clear() before the hard reload, dropping the previous tenant rows', async () => {
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } })
    const clearSpy = vi.spyOn(queryClient, 'clear')
    localStorage.setItem('active_tenant', 'tenant-a')
    queryClient.setQueryData(['candidates', 'tenant-a'], [{ id: 'c1', name: 'Tenant A candidate' }])
    vi.mocked(api.get).mockResolvedValue({ data: { user: null } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current).not.toBeNull())

    await result.current!.setActiveTenant({ id: 'tenant-b', name: 'Tenant B' })

    expect(clearSpy).toHaveBeenCalled()
    expect(localStorage.getItem('active_tenant')).toBe('tenant-b')
    expect(queryClient.getQueryData(['candidates', 'tenant-a'])).toBeUndefined()
    expect(reload).toHaveBeenCalled()
    // The cache clear must land BEFORE the reload, so a slow reload (jsdom stub is a
    // no-op) never leaves a window where the new tenant's first paint reads stale rows.
    expect(clearSpy.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0])
    clearSpy.mockRestore()
    Object.defineProperty(window, 'location', { configurable: true, value: original })
  })
})

// SUPERADMIN-FALLBACK-1 (04-09): measured as the readonly demo user, the sidebar said
// "Super admin" and every "+ Nieuw" opener rendered. /auth/me puts the tenant BESIDE
// the user, so the "no tenant" clause fired for every tenant user.
describe('AuthContext · isSuperAdmin() never fires on a profile that merely omits tenant_id', () => {
  const me = (user: Record<string, unknown>, tenant?: Record<string, unknown>) => {
    localStorage.setItem('km_session', '1')
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/auth/me' ? Promise.resolve({ data: { user, tenant } }) : Promise.reject(new Error(`unexpected GET ${url}`)))
  }

  it('a tenant user with view-only permissions is neither super admin nor allowed to create', async () => {
    me({ id: 'tom', is_super_admin: false, roles: [{ name: 'readonly' }], permissions: ['tasks.view'] }, { id: 't1', name: 'Demo' })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current?.loading).toBe(false))
    expect(result.current?.isSuperAdmin()).toBe(false)
    expect(result.current?.hasPermission('tasks.create')).toBe(false)
    expect(result.current?.hasPermission('tasks.view')).toBe(true)
    expect(result.current?.user?.tenant_id).toBe('t1')
  })

  it('the explicit flag and an explicit tenant_id: null still mean platform super admin', async () => {
    me({ id: 'd', is_super_admin: true, roles: [] })
    const a = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(a.result.current?.loading).toBe(false))
    expect(a.result.current?.isSuperAdmin()).toBe(true)
    a.unmount()
    me({ id: 'p', tenant_id: null, roles: [] })
    const b = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(b.result.current?.loading).toBe(false))
    expect(b.result.current?.isSuperAdmin()).toBe(true)
  })
})
