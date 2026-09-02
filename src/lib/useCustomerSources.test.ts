/**
 * useCustomerSources — CUST-SOURCE-FE-1. Mirrors useApplicationSources.test.ts:
 * the REAL request goes to `GET /customer-sources`, the seed/permissive-fallback
 * behaviour while pending/failed, mapping real rows, and free-entry honouring
 * the API's own flag. Each test uses a dedicated tenant id so useCachedLookup's
 * module-scope cache never leaks a mapped result between tests.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api, { getActiveTenantId } from './api'
import { useCustomerSources, DEFAULT_CUSTOMER_SOURCES } from './useCustomerSources'

vi.mock('./api', () => ({
  default: { get: vi.fn() },
  getActiveTenantId: vi.fn(() => null),
  unwrapList: (res: { data?: { data?: unknown[] } }) =>
    ({ rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0 }),
}))
const mockedGet = vi.mocked(api.get)
const mockedTenantId = vi.mocked(getActiveTenantId)
let tenantSeq = 0

// This test suite never initialises react-i18next, so `t(key, { defaultValue })`
// falls back to `defaultValue` verbatim, i.e. label === value here.
const asOptions = (names: string[]) => names.map(name => ({ value: name, label: name }))

// A fresh tenant id per test isolates useCachedLookup's module-scope cache.
const nextTenant = () => `t${tenantSeq++}`

afterEach(() => vi.clearAllMocks())

describe('useCustomerSources', () => {
  it('GETs the REAL /customer-sources lookup route', () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockReturnValue(new Promise(() => {})) // never resolves
    renderHook(() => useCustomerSources())
    expect(mockedGet).toHaveBeenCalledWith('/customer-sources', undefined)
  })

  it('returns the seed and stays permissive while the request is pending', () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useCustomerSources())
    expect(result.current.sources).toEqual(asOptions(DEFAULT_CUSTOMER_SOURCES))
    expect(result.current.allowFreeEntry).toBe(true)
  })

  // The mirror case: a failed request must not silently turn the picker strict either.
  it('stays permissive when the request fails outright', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useCustomerSources())
    await waitFor(() => expect(result.current.sources).toEqual(asOptions(DEFAULT_CUSTOMER_SOURCES)))
    expect(result.current.allowFreeEntry).toBe(true)
  })

  it('maps the distinct lookup row names once the response resolves', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockResolvedValue({
      data: { data: [{ id: 's1', name: 'LinkedIn' }, { id: 's2', name: 'Google' }], allow_free_entry: false },
    })
    const { result } = renderHook(() => useCustomerSources())
    await waitFor(() => expect(result.current.sources).toEqual(asOptions(['LinkedIn', 'Google'])))
  })

  it('keeps the seed when the lookup is empty (nothing usable in the response)', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockResolvedValue({ data: { data: [], allow_free_entry: false } })
    const { result } = renderHook(() => useCustomerSources())
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(result.current.sources).toEqual(asOptions(DEFAULT_CUSTOMER_SOURCES))
  })

  it('keeps the seed when the endpoint is unavailable (network/404)', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockRejectedValue(new Error('404'))
    const { result } = renderHook(() => useCustomerSources())
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(result.current.sources).toEqual(asOptions(DEFAULT_CUSTOMER_SOURCES))
  })

  it('honours a false allow_free_entry from the API', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockResolvedValue({ data: { data: [{ id: 's1', name: 'LinkedIn' }], allow_free_entry: false } })
    const { result } = renderHook(() => useCustomerSources())
    await waitFor(() => expect(result.current.allowFreeEntry).toBe(false))
  })

  it('honours a true allow_free_entry from the API once a tenant turns it on', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockResolvedValue({ data: { data: [{ id: 's1', name: 'LinkedIn' }], allow_free_entry: true } })
    const { result } = renderHook(() => useCustomerSources())
    await waitFor(() => expect(result.current.allowFreeEntry).toBe(true))
  })

  it('exposes invalidate() so the settings screen can force a refetch after a free-entry change', () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useCustomerSources())
    expect(typeof result.current.invalidate).toBe('function')
  })
})

// DEMO-TAAL (CUST-SOURCE-FE-1 verifier finding): the seeded "Website leads" label renders through the
// lookupSeeds.customerSources family — the VALUE stays the backend name, only the label translates.
describe('useCustomerSources · seed label translation', () => {
  it('translates the seeded label but keeps the raw name as the option value', async () => {
    const { seedKeyFor } = await import('./lookupSeedI18n')
    expect(seedKeyFor('customerSources', { value: 'Website leads', label: 'Website leads' })).toBe('websiteLeads')
    expect(seedKeyFor('customerSources', { value: 'Eigen netwerk', label: 'Eigen netwerk' })).toBeNull()
  })
})
