/**
 * useAllSettings — tenant-scoping regression tests for the shared `/settings` blob
 * loader (bijvangst fix, 2026-08): the module-scope cache/fetch-state/listeners used
 * to be single global singletons, so a super-admin switching bureaus mid-session
 * could read the PREVIOUS tenant's settings blob from this cache — the same class of
 * gap fixed on useCachedLookup and useCustomFields (see their test files). Covers:
 * same-tenant reuse (one GET), tenant-switch refetch (never serves stale data),
 * invalidateAllSettingsCache() scoped to the active tenant only, and the pub/sub
 * notify mechanism staying intact PER tenant slot (saveSettingsKeys notifies only
 * the current tenant's subscribers, not a previously-mounted other tenant's).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import api, { getActiveTenantId } from '../api'
import {
  useAllSettings, useSettingsLoaded, saveSettingsKeys, invalidateAllSettingsCache,
} from './useAllSettings'

// The default client (get/post) and getActiveTenantId are stubbed — the latter
// overridden per-call below to simulate a bureau switch mid-session. invalidateKpiCache
// is a side-effect call inside saveSettingsKeys, irrelevant to this file's contract.
vi.mock('../api', () => ({ default: { get: vi.fn(), post: vi.fn() }, getActiveTenantId: vi.fn(() => null) }))
vi.mock('../useKpiSettings', () => ({ invalidateKpiCache: vi.fn() }))

const mockedGet = vi.mocked(api.get)
const mockedPost = vi.mocked(api.post)
const mockedTenantId = vi.mocked(getActiveTenantId)

// clearAllMocks() clears call history but NOT a mockReturnValue set inside a test
// (that's mockReset) — restore the "no tenant" default explicitly so a tenant
// override in one test never leaks into the next.
afterEach(() => {
  vi.clearAllMocks()
  mockedTenantId.mockReturnValue(null)
})

describe('useAllSettings · tenant scoping', () => {
  // (a) Same tenant, second mount: one GET, cache reused — unchanged behaviour,
  // asserted explicitly so the tenant key never regresses the dedupe.
  it('reuses the cache when the tenant is unchanged', async () => {
    mockedTenantId.mockReturnValue('tenant-as-same')
    mockedGet.mockResolvedValue({ data: { foo: 'a-value' } })

    const first = renderHook(() => useAllSettings())
    await waitFor(() => expect(first.result.current.foo).toBe('a-value'))
    expect(mockedGet).toHaveBeenCalledTimes(1)

    const second = renderHook(() => useAllSettings())
    await waitFor(() => expect(second.result.current.foo).toBe('a-value'))
    expect(mockedGet).toHaveBeenCalledTimes(1) // still just the one GET
  })

  // (b) DIFFERENT active tenant: must refetch and must NOT hand back tenant A's
  // cached blob to tenant B — this is the actual vulnerability.
  it('refetches (and never leaks the previous tenant\'s blob) after a tenant switch', async () => {
    mockedTenantId.mockReturnValue('tenant-as-switch-a')
    mockedGet.mockResolvedValue({ data: { foo: 'a-value' } })

    const forTenantA = renderHook(() => useAllSettings())
    await waitFor(() => expect(forTenantA.result.current.foo).toBe('a-value'))
    expect(mockedGet).toHaveBeenCalledTimes(1)

    mockedTenantId.mockReturnValue('tenant-as-switch-b')
    mockedGet.mockResolvedValue({ data: { foo: 'b-value' } })

    const forTenantB = renderHook(() => useAllSettings())
    await waitFor(() => expect(forTenantB.result.current.foo).toBe('b-value'))
    expect(mockedGet).toHaveBeenCalledTimes(2) // a real second GET, not a cache hit
    expect(forTenantB.result.current.foo).not.toBe('a-value')
  })

  // (c) invalidateAllSettingsCache() must only refetch+clear the ACTIVE tenant's
  // slot — a previously-cached other tenant stays untouched (no extra GET on return).
  it('invalidateAllSettingsCache() only clears the active tenant\'s slot', async () => {
    mockedTenantId.mockReturnValue('tenant-as-inv-a')
    mockedGet.mockResolvedValue({ data: { foo: 'a1' } })
    const forTenantA = renderHook(() => useAllSettings())
    await waitFor(() => expect(forTenantA.result.current.foo).toBe('a1'))

    mockedTenantId.mockReturnValue('tenant-as-inv-b')
    mockedGet.mockResolvedValue({ data: { foo: 'b1' } })
    const forTenantB = renderHook(() => useAllSettings())
    await waitFor(() => expect(forTenantB.result.current.foo).toBe('b1'))
    expect(mockedGet).toHaveBeenCalledTimes(2)

    // Tenant B is still active — invalidate must refetch B only.
    mockedGet.mockResolvedValue({ data: { foo: 'b2' } })
    invalidateAllSettingsCache()
    await waitFor(() => expect(forTenantB.result.current.foo).toBe('b2'))
    expect(mockedGet).toHaveBeenCalledTimes(3)

    // Switching back to tenant A must still read A's untouched cache — no 4th GET.
    mockedTenantId.mockReturnValue('tenant-as-inv-a')
    const backToTenantA = renderHook(() => useAllSettings())
    expect(backToTenantA.result.current.foo).toBe('a1')
    expect(mockedGet).toHaveBeenCalledTimes(3)
  })

  // (d) saveSettingsKeys() merges into and notifies ONLY the active tenant's
  // subscribers — a concurrently-mounted other tenant must never see the write.
  it('saveSettingsKeys() merges + notifies only the active tenant\'s subscribers', async () => {
    mockedTenantId.mockReturnValue('tenant-as-save-a')
    mockedGet.mockResolvedValue({ data: { existing: 'kept' } })
    mockedPost.mockResolvedValue({ data: {} })

    const forTenantA = renderHook(() => useAllSettings())
    await waitFor(() => expect(forTenantA.result.current.existing).toBe('kept'))

    // A second tenant, concurrently mounted, must not see tenant A's later save.
    mockedTenantId.mockReturnValue('tenant-as-save-b')
    mockedGet.mockResolvedValue({ data: { existing: 'other' } })
    const forTenantB = renderHook(() => useAllSettings())
    await waitFor(() => expect(forTenantB.result.current.existing).toBe('other'))

    // Save while tenant A is (again) the active tenant.
    mockedTenantId.mockReturnValue('tenant-as-save-a')
    await act(async () => { await saveSettingsKeys({ new_key: 'value' }) })

    expect(mockedPost).toHaveBeenCalledWith('/settings', { new_key: 'value' })
    expect(forTenantA.result.current.new_key).toBe('value')
    expect(forTenantA.result.current.existing).toBe('kept') // merged, not replaced
    expect(forTenantB.result.current.new_key).toBeUndefined() // tenant B untouched
  })
})

describe('useSettingsLoaded · tenant scoping', () => {
  // (e) A fresh tenant with nothing cached yet must read false, never a stale
  // "true" carried over from a previously-loaded tenant. useSettingsLoaded() itself
  // never fetches (mirrors the original) — it reflects whichever tenant slot
  // useAllSettings() (mounted alongside it in the real app) already resolved.
  it('reflects the active tenant\'s load state, not a previous tenant\'s', async () => {
    mockedTenantId.mockReturnValue('tenant-as-loaded-a')
    mockedGet.mockResolvedValue({ data: { marker: 'a' } })
    // useAllSettings() is what actually triggers + resolves the fetch for tenant A.
    const settingsForA = renderHook(() => useAllSettings())
    await waitFor(() => expect(settingsForA.result.current.marker).toBe('a'))

    const loadedForA = renderHook(() => useSettingsLoaded())
    expect(loadedForA.result.current).toBe(true) // tenant A's slot is already cached

    // Tenant B has no cached slot yet — must read false, not A's stale true.
    mockedTenantId.mockReturnValue('tenant-as-loaded-b')
    const loadedForB = renderHook(() => useSettingsLoaded())
    expect(loadedForB.result.current).toBe(false)
  })
})
