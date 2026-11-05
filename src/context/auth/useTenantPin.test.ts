/**
 * useTenantPin — SHARED-UNIT-TEST-1 for the bureau slice moved out of AuthContext (#117): the
 * stored-bureau resolution branches, the staff path, the auth-response sync, the once-per-boot
 * refusal event, the cross-tab reload and the super admin's switch. Requests are asserted on the
 * adapter (REQUEST-ASSERT-1); the provider-level behaviour stays covered by AuthContext.test.tsx.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import api from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { TENANT_PICK_FLAG, TENANT_REQUIRED_EVENT } from '@/lib/tenantResolution'
import type { AuthUser } from './permissions'
import { useTenantPin } from './useTenantPin'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(async () => ({ data: {} })) } }
})

const superAdmin = { id: 'sa', is_super_admin: true, roles: [] } as unknown as AuthUser
const staff = { id: 'tom', is_super_admin: false, roles: [], tenant: { id: 't9', name: 'Own' } } as unknown as AuthUser

// Replaces window.location.reload with a spy for one test and hands back the restore function.
const stubReload = () => {
  const reload = vi.fn()
  const original = window.location
  Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } })
  return { reload, restore: () => Object.defineProperty(window, 'location', { configurable: true, value: original }) }
}

afterEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

describe('useTenantPin · setupTenants', () => {
  it('super admin: GETs /tenants and pins the stored bureau the list still carries', async () => {
    localStorage.setItem('active_tenant', 't1')
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 't1', name: 'One' }, { id: 't2', name: 'Two' }] })
    const { result } = renderHook(() => useTenantPin(superAdmin))
    await act(() => result.current.setupTenants(superAdmin))
    expect(api.get).toHaveBeenCalledWith('/tenants')
    expect(result.current.tenants).toHaveLength(2)
    expect(result.current.activeTenant).toEqual({ id: 't1', name: 'One' })
    expect(result.current.needsTenantPick).toBe(false)
    expect(result.current.tenantsError).toBe(false)
    expect(localStorage.getItem('active_tenant')).toBe('t1')
  })

  it('super admin: a stored bureau missing from /tenants is dropped and the picker is raised, never a first-row guess', async () => {
    localStorage.setItem('active_tenant', 'gone')
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 't1', name: 'One' }] })
    const { result } = renderHook(() => useTenantPin(superAdmin))
    await act(() => result.current.setupTenants(superAdmin))
    expect(result.current.needsTenantPick).toBe(true)
    expect(result.current.activeTenant).toBeNull()
    expect(localStorage.getItem('active_tenant')).toBeNull()
  })

  it('super admin: a failed /tenants fetch sets tenantsError and keeps the stored id without guessing', async () => {
    localStorage.setItem('active_tenant', 't1')
    vi.mocked(api.get).mockRejectedValue(new Error('down'))
    const { result } = renderHook(() => useTenantPin(superAdmin))
    await act(() => result.current.setupTenants(superAdmin))
    expect(result.current.tenantsError).toBe(true)
    expect(result.current.tenants).toEqual([])
    expect(result.current.activeTenant).toEqual({ id: 't1' })
    expect(localStorage.getItem('active_tenant')).toBe('t1')
  })

  it('staff: uses the tenant from /auth/me and never calls /tenants', async () => {
    const { result } = renderHook(() => useTenantPin(staff))
    await act(() => result.current.setupTenants(staff))
    expect(api.get).not.toHaveBeenCalled()
    expect(result.current.tenants).toEqual([{ id: 't9', name: 'Own' }])
    expect(result.current.activeTenant).toEqual({ id: 't9', name: 'Own' })
    expect(localStorage.getItem('active_tenant')).toBe('t9')
  })
})

describe('useTenantPin · pinTenantAfterAuth', () => {
  it('pins the tenant an auth response names without a /tenants call', async () => {
    const { result } = renderHook(() => useTenantPin(staff))
    await act(() => result.current.pinTenantAfterAuth({ id: 't9', name: 'Own' } as never))
    expect(api.get).not.toHaveBeenCalled()
    expect(result.current.activeTenant).toEqual({ id: 't9', name: 'Own' })
    expect(result.current.tenants).toEqual([{ id: 't9', name: 'Own' }])
    expect(result.current.needsTenantPick).toBe(false)
    expect(localStorage.getItem('active_tenant')).toBe('t9')
  })

  it('without a tenant in the response resolves the stored bureau against GET /tenants', async () => {
    localStorage.setItem('active_tenant', 't2')
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 't1', name: 'One' }, { id: 't2', name: 'Two' }] })
    const { result } = renderHook(() => useTenantPin(superAdmin))
    await act(() => result.current.pinTenantAfterAuth(null))
    expect(api.get).toHaveBeenCalledWith('/tenants')
    expect(result.current.activeTenant).toEqual({ id: 't2', name: 'Two' })
    expect(result.current.needsTenantPick).toBe(false)
  })
})

describe('useTenantPin · pinTenantAfterAuth · failed list', () => {
  it('keeps the stored id without guessing when GET /tenants rejects', async () => {
    localStorage.setItem('active_tenant', 't2')
    vi.mocked(api.get).mockRejectedValue(new Error('down'))
    const { result } = renderHook(() => useTenantPin(superAdmin))
    await act(() => result.current.pinTenantAfterAuth(null))
    expect(api.get).toHaveBeenCalledWith('/tenants')
    expect(result.current.activeTenant).toEqual({ id: 't2' })
    expect(result.current.needsTenantPick).toBe(false)
    expect(localStorage.getItem('active_tenant')).toBe('t2')
  })
})

describe('useTenantPin · adoptResponseTenant and resetTenantState', () => {
  it('adopts the response tenant when none is active, keeps a super admin\'s own pick otherwise', () => {
    const { result } = renderHook(() => useTenantPin(superAdmin))
    act(() => result.current.adoptResponseTenant({ id: 'a', name: 'A' } as never))
    expect(result.current.activeTenant).toEqual({ id: 'a', name: 'A' })
    expect(localStorage.getItem('active_tenant')).toBe('a')
    act(() => result.current.adoptResponseTenant({ id: 'b', name: 'B' } as never))
    expect(result.current.activeTenant).toEqual({ id: 'a', name: 'A' })
    expect(localStorage.getItem('active_tenant')).toBe('a')
  })

  it('resetTenantState drops the list, the active bureau and the picker wall', () => {
    const { result } = renderHook(() => useTenantPin(superAdmin))
    act(() => result.current.adoptResponseTenant({ id: 'a', name: 'A' } as never))
    act(() => result.current.resetTenantState())
    expect(result.current.tenants).toEqual([])
    expect(result.current.activeTenant).toBeNull()
    expect(result.current.needsTenantPick).toBe(false)
  })
})

describe('useTenantPin · events and the switch', () => {
  it('the km:tenant-required event drops the stored bureau and raises the picker for a super admin', async () => {
    localStorage.setItem('active_tenant', 't1')
    const { result } = renderHook(() => useTenantPin(superAdmin))
    act(() => result.current.adoptResponseTenant({ id: 't1', name: 'One' } as never))
    act(() => { window.dispatchEvent(new CustomEvent(TENANT_REQUIRED_EVENT, { detail: { code: 'tenant_not_found' } })) })
    await waitFor(() => expect(result.current.needsTenantPick).toBe(true))
    expect(result.current.activeTenant).toBeNull()
    expect(localStorage.getItem('active_tenant')).toBeNull()
  })

  it('the same event only re-arms the pick signal for staff and leaves their bureau alone', () => {
    localStorage.setItem('active_tenant', 't9')
    sessionStorage.setItem(TENANT_PICK_FLAG, '1')
    const { result } = renderHook(() => useTenantPin(staff))
    act(() => { window.dispatchEvent(new CustomEvent(TENANT_REQUIRED_EVENT, { detail: { code: 'tenant_required' } })) })
    expect(result.current.needsTenantPick).toBe(false)
    expect(localStorage.getItem('active_tenant')).toBe('t9')
    expect(sessionStorage.getItem(TENANT_PICK_FLAG)).toBeNull()
  })

  it('a bureau switch in another tab reloads this tab; an unrelated key or a first write does not', () => {
    const { reload, restore } = stubReload()
    renderHook(() => useTenantPin(superAdmin))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'active_tenant', oldValue: 't1', newValue: 't2' })) })
    expect(reload).toHaveBeenCalledTimes(1)
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'active_tenant', oldValue: null, newValue: 't2' })) })
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'other', oldValue: 'x', newValue: 'y' })) })
    expect(reload).toHaveBeenCalledTimes(1)
    restore()
  })

  it('setActiveTenant stores the pick, lifts the wall, re-arms the signal, clears react-query and reloads', async () => {
    const { reload, restore } = stubReload()
    const clearSpy = vi.spyOn(queryClient, 'clear')
    sessionStorage.setItem(TENANT_PICK_FLAG, '1')
    const { result } = renderHook(() => useTenantPin(superAdmin))
    await act(() => result.current.setActiveTenant({ id: 't2', name: 'Two' } as never))
    expect(localStorage.getItem('active_tenant')).toBe('t2')
    expect(result.current.activeTenant).toEqual({ id: 't2', name: 'Two' })
    expect(result.current.needsTenantPick).toBe(false)
    expect(sessionStorage.getItem(TENANT_PICK_FLAG)).toBeNull()
    expect(clearSpy).toHaveBeenCalled()
    expect(reload).toHaveBeenCalledTimes(1)
    restore()
  })
})
