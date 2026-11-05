/** AuthContext · MFA re-prime, stale tenant pinning and upload policy (split from AuthContext.test.tsx). */
import { describe, it, expect, afterEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import api, { primeCsrf } from '@/lib/api'
import { AuthProvider, useAuth } from './AuthContext'
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
