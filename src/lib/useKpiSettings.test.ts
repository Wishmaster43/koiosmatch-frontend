/**
 * useKpiSettings — tenant-scoping regression tests (bijvangst fix, 2026-08): the
 * module-scope cache used to be a single global slot (`let cache`), so a super-admin
 * switching bureaus mid-session could read the PREVIOUS tenant's KPI targets — the
 * same class of gap fixed on useCachedLookup/useCustomFields/useAllSettings (see
 * their test files). Covers: same-tenant reuse (one GET), tenant-switch refetch
 * (never serves stale targets), and invalidateKpiCache() scoped to the active tenant.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api, { getActiveTenantId } from './api'
import { useKpiSettings, invalidateKpiCache, SETTING_DEFAULTS } from './useKpiSettings'

// The default client is stubbed, plus getActiveTenantId — overridden per-call
// below to simulate a bureau switch mid-session.
vi.mock('./api', () => ({ default: { get: vi.fn() }, getActiveTenantId: vi.fn(() => null) }))
const mockedGet = vi.mocked(api.get)
const mockedTenantId = vi.mocked(getActiveTenantId)

// clearAllMocks() clears call history but NOT a mockReturnValue set inside a test
// (that's mockReset) — restore the "no tenant" default explicitly so a tenant
// override in one test never leaks into the next.
afterEach(() => {
  vi.clearAllMocks()
  mockedTenantId.mockReturnValue(null)
})

describe('useKpiSettings · tenant scoping', () => {
  // (a) Same tenant, second mount: one GET, cache reused — unchanged behaviour,
  // asserted explicitly so the tenant key never regresses the dedupe.
  it('reuses the cache when the tenant is unchanged', async () => {
    mockedTenantId.mockReturnValue('tenant-kpi-same')
    mockedGet.mockResolvedValue({ data: { new_candidates_target: 42 } })

    const first = renderHook(() => useKpiSettings())
    await waitFor(() => expect(first.result.current.new_candidates_target).toBe(42))
    expect(mockedGet).toHaveBeenCalledTimes(1)

    const second = renderHook(() => useKpiSettings())
    expect(second.result.current.new_candidates_target).toBe(42)
    expect(mockedGet).toHaveBeenCalledTimes(1) // still just the one GET
  })

  // (b) DIFFERENT active tenant: must refetch and must NOT hand back tenant A's
  // cached targets to tenant B — this is the actual vulnerability.
  it('refetches (and never leaks the previous tenant\'s targets) after a tenant switch', async () => {
    mockedTenantId.mockReturnValue('tenant-kpi-switch-a')
    mockedGet.mockResolvedValue({ data: { new_candidates_target: 11 } })

    const forTenantA = renderHook(() => useKpiSettings())
    await waitFor(() => expect(forTenantA.result.current.new_candidates_target).toBe(11))
    expect(mockedGet).toHaveBeenCalledTimes(1)

    mockedTenantId.mockReturnValue('tenant-kpi-switch-b')
    mockedGet.mockResolvedValue({ data: { new_candidates_target: 22 } })

    const forTenantB = renderHook(() => useKpiSettings())
    await waitFor(() => expect(forTenantB.result.current.new_candidates_target).toBe(22))
    expect(mockedGet).toHaveBeenCalledTimes(2) // a real second GET, not a cache hit
  })

  // (c) A tenant with no stored value for a key falls back to SETTING_DEFAULTS,
  // exactly like the un-scoped hook did — the tenant key must not change this.
  it('falls back to SETTING_DEFAULTS for a key the tenant never saved', async () => {
    mockedTenantId.mockReturnValue('tenant-kpi-defaults')
    mockedGet.mockResolvedValue({ data: {} })

    const { result } = renderHook(() => useKpiSettings())
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1))
    expect(result.current.occupancy_target).toBe(SETTING_DEFAULTS.occupancy_target)
  })

  // (d) invalidateKpiCache() only clears the CURRENT tenant's slot — switching
  // back to tenant A afterwards must still find A's entry cached (untouched by B's call).
  it('invalidateKpiCache() only clears the active tenant\'s slot, not other tenants\'', async () => {
    mockedTenantId.mockReturnValue('tenant-kpi-inv-a')
    mockedGet.mockResolvedValue({ data: { new_candidates_target: 5 } })
    const forTenantA = renderHook(() => useKpiSettings())
    await waitFor(() => expect(forTenantA.result.current.new_candidates_target).toBe(5))
    expect(mockedGet).toHaveBeenCalledTimes(1)

    mockedTenantId.mockReturnValue('tenant-kpi-inv-b')
    mockedGet.mockResolvedValue({ data: { new_candidates_target: 6 } })
    const forTenantB = renderHook(() => useKpiSettings())
    await waitFor(() => expect(forTenantB.result.current.new_candidates_target).toBe(6))
    invalidateKpiCache() // clears only tenant-b's slot (still active)

    mockedTenantId.mockReturnValue('tenant-kpi-inv-a')
    const backToTenantA = renderHook(() => useKpiSettings())
    expect(backToTenantA.result.current.new_candidates_target).toBe(5) // still cached, no 3rd GET
    expect(mockedGet).toHaveBeenCalledTimes(2)

    // Tenant B's slot WAS cleared — remounting it must trigger a fresh fetch.
    mockedTenantId.mockReturnValue('tenant-kpi-inv-b')
    mockedGet.mockResolvedValue({ data: { new_candidates_target: 7 } })
    const backToTenantB = renderHook(() => useKpiSettings())
    await waitFor(() => expect(backToTenantB.result.current.new_candidates_target).toBe(7))
    expect(mockedGet).toHaveBeenCalledTimes(3)
  })
})
