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
import { renderHook, waitFor, act } from '@testing-library/react'
import api, { primeCsrf } from '@/lib/api'
import { AuthProvider, useAuth } from './AuthContext'
import { queryClient } from '@/lib/queryClient'
import { getUploadPolicy, UPLOAD_POLICY_SEED } from '@/lib/uploadPolicy'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, primeCsrf: vi.fn(async () => undefined), default: { get: vi.fn(), post: vi.fn(async () => ({ data: {} })) } }
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
    localStorage.setItem('wf_graph_x', '{}')
    queryClient.setQueryData(['users', 'demo'], [{ id: 'u1', name: 'Vorige gebruiker' }])
    vi.mocked(api.get).mockResolvedValue({ data: { user: null } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current).not.toBeNull())
    await result.current!.logout()
    expect(clearSpy).toHaveBeenCalled()
    expect(queryClient.getQueryData(['users', 'demo'])).toBeUndefined()
    expect(localStorage.getItem('enabled_apps')).toBeNull()
    expect(localStorage.getItem('active_tenant')).toBeNull()
    expect(localStorage.getItem('wf_graph_x')).toBeNull()
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
// ONIX C-003 (BE 51bc7f3c): super admin is the explicit is_super_admin flag or role, never
// "a profile without a tenant" — that proxy was the audit finding.
describe('AuthContext · isSuperAdmin() is the explicit flag or role, never a missing tenant', () => {
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
    expect(result.current?.user?.tenant_id).toBeUndefined()
  })

  it('the explicit flag means platform super admin; an explicit tenant_id: null alone does not', async () => {
    me({ id: 'd', is_super_admin: true, roles: [] })
    const a = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(a.result.current?.loading).toBe(false))
    expect(a.result.current?.isSuperAdmin()).toBe(true)
    a.unmount()
    me({ id: 'p', tenant_id: null, is_super_admin: false, roles: [] })
    const b = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(b.result.current?.loading).toBe(false))
    expect(b.result.current?.isSuperAdmin()).toBe(false)
  })
})

// D8 fix: a failed /tenants call (super-admin tenant list) must be distinguishable from "no tenants" so the switcher can render an honest error.
describe('AuthContext · tenantsError surfaces a failed super-admin /tenants fetch', () => {
  it('sets tenantsError and leaves tenants empty when GET /tenants rejects', async () => {
    localStorage.setItem('km_session', '1')
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: { user: { id: 'sa', is_super_admin: true, roles: [] } } })
      if (url === '/tenants') return Promise.reject(new Error('network error'))
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current?.loading).toBe(false))
    expect(result.current?.tenantsError).toBe(true)
    expect(result.current?.tenants).toEqual([])
  })

  it('clears tenantsError on a successful /tenants fetch', async () => {
    localStorage.setItem('km_session', '1')
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: { user: { id: 'sa', is_super_admin: true, roles: [] } } })
      if (url === '/tenants') return Promise.resolve({ data: [{ id: 't1', name: 'Tenant One' }] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current?.loading).toBe(false))
    expect(result.current?.tenantsError).toBe(false)
    expect(result.current?.tenants).toEqual([{ id: 't1', name: 'Tenant One' }])
  })
})

// ONIX C-001: the MFA branch regenerates the CSRF token, so verify re-primes the cookie first.
describe('AuthContext · verifyMfa re-primes CSRF', () => {
  const setup = async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { user: null } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current?.loading).toBe(false))
    vi.mocked(api.post).mockClear()
    return result
  }

  it('calls primeCsrf BEFORE posting /auth/mfa/verify with the token and code', async () => {
    const result = await setup()
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: 'u1', roles: [] } } })
    await result.current?.verifyMfa('tok', '123456').catch(() => undefined)
    expect(api.post).toHaveBeenCalledWith('/auth/mfa/verify', { mfa_token: 'tok', code: '123456' })
    expect(vi.mocked(primeCsrf).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(api.post).mock.invocationCallOrder[0])
  })

  it('still posts when primeCsrf rejects', async () => {
    const result = await setup()
    vi.mocked(primeCsrf).mockRejectedValueOnce(new Error('network'))
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: 'u1', roles: [] } } })
    await result.current?.verifyMfa('tok', '123456').catch(() => undefined)
    expect(api.post).toHaveBeenCalledWith('/auth/mfa/verify', { mfa_token: 'tok', code: '123456' })
  })
})

// ONIX B-005 + B-003 (TENANT-PICKER-FE-1, Danny 4a = A): a stored tenant id that /tenants no
// longer lists must not survive a login, and the client never guesses a first bureau instead.
describe('AuthContext · stale stored tenant', () => {
  it('drops a stored id missing from /tenants and raises the bureau picker instead of pinning the first row', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 't1', name: 'One' }, { id: 't2', name: 'Two' }] })
    localStorage.setItem('active_tenant', 'deleted-bureau')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current?.loading).toBe(false))
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: 'u1', roles: [] } } })
    await result.current?.login('a@b.nl', 'pw')
    expect(localStorage.getItem('active_tenant')).toBeNull()
    // The state writes land after the awaited login promise — observe them through waitFor.
    await waitFor(() => expect(result.current?.needsTenantPick).toBe(true))
    expect(result.current?.activeTenant).toBeNull()
    expect(result.current?.tenants).toEqual([{ id: 't1', name: 'One' }, { id: 't2', name: 'Two' }])
  })

  it('removes a stale stored tenant id and never writes a guessed one', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 't1', name: 'One' }] })
    localStorage.setItem('active_tenant', 'deleted-bureau')
    const setSpy = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current?.loading).toBe(false))
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: 'u1', roles: [] } } })
    await result.current?.login('a@b.nl', 'pw')
    expect(setSpy.mock.calls.filter(c => c[0] === 'active_tenant')).toHaveLength(0)
    expect(localStorage.getItem('active_tenant')).toBeNull()
    setSpy.mockRestore()
  })

  it('keeps a stored tenant id that /tenants still lists after a super-admin login', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 't1', name: 'One' }, { id: 't2', name: 'Two' }] })
    localStorage.setItem('active_tenant', 't2')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current?.loading).toBe(false))
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: 'sa', is_super_admin: true, roles: [] } } })
    await result.current?.login('a@b.nl', 'pw')
    expect(localStorage.getItem('active_tenant')).toBe('t2')
    await waitFor(() => expect(result.current?.activeTenant).toEqual({ id: 't2', name: 'Two' }))
    expect(result.current?.needsTenantPick).toBe(false)
  })

  it('raises the picker at boot for a super admin whose stored bureau is gone, and pins a stored one that still exists', async () => {
    localStorage.setItem('km_session', '1')
    localStorage.setItem('active_tenant', 'deleted-bureau')
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: { user: { id: 'sa', is_super_admin: true, roles: [] } } })
      if (url === '/tenants') return Promise.resolve({ data: [{ id: 't1', name: 'One' }] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    const first = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(first.result.current?.loading).toBe(false))
    expect(first.result.current?.needsTenantPick).toBe(true)
    expect(first.result.current?.activeTenant).toBeNull()
    expect(localStorage.getItem('active_tenant')).toBeNull()
    first.unmount()

    localStorage.setItem('active_tenant', 't1')
    const second = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(second.result.current?.loading).toBe(false))
    expect(second.result.current?.needsTenantPick).toBe(false)
    expect(second.result.current?.activeTenant).toEqual({ id: 't1', name: 'One' })
  })

  it('the km:tenant-required event drops the stored bureau and raises the picker for a super admin only', async () => {
    localStorage.setItem('km_session', '1')
    localStorage.setItem('active_tenant', 't1')
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: { user: { id: 'sa', is_super_admin: true, roles: [] } } })
      if (url === '/tenants') return Promise.resolve({ data: [{ id: 't1', name: 'One' }] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    const sa = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(sa.result.current?.activeTenant).toEqual({ id: 't1', name: 'One' }))
    act(() => { window.dispatchEvent(new CustomEvent('km:tenant-required', { detail: { code: 'tenant_not_found' } })) })
    await waitFor(() => expect(sa.result.current?.needsTenantPick).toBe(true))
    expect(sa.result.current?.activeTenant).toBeNull()
    expect(localStorage.getItem('active_tenant')).toBeNull()
    sa.unmount()

    // Staff carry their own bureau from /auth/me; the event is not theirs to act on.
    localStorage.clear()
    localStorage.setItem('km_session', '1')
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: { user: { id: 'tom', is_super_admin: false, roles: [], tenant: { id: 't9', name: 'Own' } } } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    const staff = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(staff.result.current?.loading).toBe(false))
    act(() => { window.dispatchEvent(new CustomEvent('km:tenant-required', { detail: { code: 'tenant_required' } })) })
    expect(staff.result.current?.needsTenantPick).toBe(false)
    expect(localStorage.getItem('active_tenant')).toBe('t9')
  })
})

// UPLOAD-POLICY-1: /auth/me's root `uploads` key feeds the shared upload-policy store.
describe('AuthContext · upload policy from /auth/me', () => {
  it('adopts the server policy per surface and keeps the seed for the surfaces it omits', async () => {
    localStorage.setItem('km_session', '1')
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/auth/me') return Promise.resolve({ data: {
        user: { id: 'tom', is_super_admin: false, roles: [], tenant: { id: 't1', name: 'One' } },
        uploads: { documents: { extensions: ['pdf', 'docx'], mimes: ['application/pdf'], max_bytes: 2097152 } },
      } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current?.loading).toBe(false))
    expect(getUploadPolicy().documents.extensions).toEqual(['pdf', 'docx'])
    expect(getUploadPolicy().documents.max_bytes).toBe(2097152)
    expect(getUploadPolicy().cv_parse.extensions).toEqual(UPLOAD_POLICY_SEED.cv_parse.extensions)
  })
})

// B-003 beyond page one: a stored bureau missing from the first page is looked up by exact id.
describe('AuthContext · stored bureau beyond the first /tenants page', () => {
  const page1 = Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }))
  const mockTenants = (searchRows: unknown[]) => vi.mocked(api.get).mockImplementation((url: string, cfg?: { params?: unknown }) => {
    if (url === '/tenants' && (cfg?.params as { search?: string } | undefined)?.search) return Promise.resolve({ data: { data: searchRows } })
    if (url === '/tenants') return Promise.resolve({ data: { data: page1, meta: { total: 26, last_page: 2 } } })
    return Promise.resolve({ data: { user: null } })
  })

  it('login pins t26 found by exact-id search, keeps localStorage, no picker', async () => {
    mockTenants([{ id: 't26', name: 'T26' }])
    localStorage.setItem('active_tenant', 't26')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current?.loading).toBe(false))
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: 'sa', is_super_admin: true, roles: [] } } })
    await result.current?.login('a@b.nl', 'pw')
    await waitFor(() => expect(result.current?.activeTenant?.id).toBe('t26'))
    expect(result.current?.needsTenantPick).toBe(false)
    expect(localStorage.getItem('active_tenant')).toBe('t26')
    expect(vi.mocked(api.get)).toHaveBeenCalledWith('/tenants', { params: { search: 't26', per_page: 100 } })
  })

  it('an empty search result removes the id and raises the picker', async () => {
    mockTenants([])
    localStorage.setItem('active_tenant', 't26')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current?.loading).toBe(false))
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: 'sa', is_super_admin: true, roles: [] } } })
    await result.current?.login('a@b.nl', 'pw')
    await waitFor(() => expect(result.current?.needsTenantPick).toBe(true))
    expect(localStorage.getItem('active_tenant')).toBeNull()
  })

  it('a pending stored bureau raises the picker instead of pinning', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 't1', name: 'One', provisioning_status: 'pending' }] })
    localStorage.setItem('active_tenant', 't1')
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current?.loading).toBe(false))
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: 'sa', is_super_admin: true, roles: [] } } })
    await result.current?.login('a@b.nl', 'pw')
    await waitFor(() => expect(result.current?.needsTenantPick).toBe(true))
    expect(result.current?.activeTenant).toBeNull()
  })

  it('setupMfa posts the password only when given', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { user: null } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current?.loading).toBe(false))
    await result.current?.setupMfa()
    expect(vi.mocked(api.post)).toHaveBeenLastCalledWith('/auth/mfa/setup', {})
    await result.current?.setupMfa('pw')
    expect(vi.mocked(api.post)).toHaveBeenLastCalledWith('/auth/mfa/setup', { current_password: 'pw' })
  })

  // Boot path (#31): /auth/me returns a super admin and the stored t26 is found by exact-id search.
  const mockBoot = (searchRows: unknown[]) => vi.mocked(api.get).mockImplementation((url: string, cfg?: { params?: unknown }) => {
    if (url === '/auth/me') return Promise.resolve({ data: { user: { id: 'sa', is_super_admin: true, roles: [] } } })
    if (url === '/tenants' && (cfg?.params as { search?: string } | undefined)?.search) return Promise.resolve({ data: { data: searchRows } })
    if (url === '/tenants') return Promise.resolve({ data: { data: page1, meta: { total: 26, last_page: 2 } } })
    return Promise.resolve({ data: {} })
  })

  it('boot pins t26 beyond page one via the exact-id search', async () => {
    localStorage.setItem('km_session', '1')
    localStorage.setItem('active_tenant', 't26')
    mockBoot([{ id: 't26', name: 'T26' }])
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current?.activeTenant?.id).toBe('t26'))
    expect(result.current?.needsTenantPick).toBe(false)
    expect(localStorage.getItem('active_tenant')).toBe('t26')
    expect(vi.mocked(api.get)).toHaveBeenCalledWith('/tenants', { params: { search: 't26', per_page: 100 } })
  })

  it('restore and login reach the same outcome for a stale stored id', async () => {
    // Restore (boot): the stale id is dropped and the picker is raised.
    localStorage.setItem('km_session', '1')
    localStorage.setItem('active_tenant', 'gone')
    vi.mocked(api.get).mockImplementation((url: string) => Promise.resolve(
      url === '/auth/me' ? { data: { user: { id: 'sa', is_super_admin: true, roles: [] } } } : { data: [{ id: 't1', name: 'One' }] }))
    const boot = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(boot.result.current?.needsTenantPick).toBe(true))
    expect(localStorage.getItem('active_tenant')).toBeNull()
    boot.unmount()
    // Login: the same stale id gives the same outcome.
    localStorage.clear()
    localStorage.setItem('active_tenant', 'gone')
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 't1', name: 'One' }] })
    const login = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(login.result.current?.loading).toBe(false))
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: 'sa', is_super_admin: true, roles: [] } } })
    await login.result.current?.login('a@b.nl', 'pw')
    await waitFor(() => expect(login.result.current?.needsTenantPick).toBe(true))
    expect(localStorage.getItem('active_tenant')).toBeNull()
  })

  it('logout re-arms the tenant pick signal', async () => {
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } })
    sessionStorage.setItem('km_tenant_pick', '1')
    sessionStorage.setItem('km_tenant_pick_code', 'tenant_required')
    vi.mocked(api.get).mockResolvedValue({ data: { user: null } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current).not.toBeNull())
    await result.current!.logout()
    expect(vi.mocked(api.post)).toHaveBeenCalledWith('/auth/logout')
    expect(sessionStorage.getItem('km_tenant_pick')).toBeNull()
    expect(sessionStorage.getItem('km_tenant_pick_code')).toBeNull()
    Object.defineProperty(window, 'location', { configurable: true, value: original })
  })
})
