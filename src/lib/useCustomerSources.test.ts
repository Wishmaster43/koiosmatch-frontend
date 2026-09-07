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
// KEY-ADOPTION: asOptions now includes key (null for seed, real key for API rows).
const asOptions = (names: string[], keys?: (string | null)[]) => names.map((name, i) => ({
  value: name,
  label: name,
  key: keys?.[i] ?? null
}))

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
    // DEFAULT_CUSTOMER_SOURCES is now {name,key}[] — extract names for asOptions.
    const seedNames = DEFAULT_CUSTOMER_SOURCES.map(s => s.name)
    expect(result.current.sources).toEqual(asOptions(seedNames))
    expect(result.current.allowFreeEntry).toBe(true)
  })

  // The mirror case: a failed request must not silently turn the picker strict either.
  it('stays permissive when the request fails outright', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useCustomerSources())
    const seedNames = DEFAULT_CUSTOMER_SOURCES.map(s => s.name)
    await waitFor(() => expect(result.current.sources).toEqual(asOptions(seedNames)))
    expect(result.current.allowFreeEntry).toBe(true)
  })

  // KEY-ADOPTION: maps the distinct lookup row names AND their stable keys.
  it('maps the distinct lookup row names and keys once the response resolves', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockResolvedValue({
      data: { data: [{ id: 's1', name: 'LinkedIn', key: 'linkedin' }, { id: 's2', name: 'Google', key: 'google' }], allow_free_entry: false },
    })
    const { result } = renderHook(() => useCustomerSources())
    await waitFor(() => expect(result.current.sources).toEqual(asOptions(['LinkedIn', 'Google'], ['linkedin', 'google'])))
  })

  it('keeps the seed when the lookup is empty (nothing usable in the response)', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockResolvedValue({ data: { data: [], allow_free_entry: false } })
    const { result } = renderHook(() => useCustomerSources())
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    const seedNames = DEFAULT_CUSTOMER_SOURCES.map(s => s.name)
    expect(result.current.sources).toEqual(asOptions(seedNames))
  })

  it('keeps the seed when the endpoint is unavailable (network/404)', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockRejectedValue(new Error('404'))
    const { result } = renderHook(() => useCustomerSources())
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    const seedNames = DEFAULT_CUSTOMER_SOURCES.map(s => s.name)
    expect(result.current.sources).toEqual(asOptions(seedNames))
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

// KEY-ADOPTION: API rows without a key field default to null (backward compat).
describe('useCustomerSources · backward compat: missing key', () => {
  it('defaults to key=null when an API row omits the key field', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockResolvedValue({
      data: { data: [{ id: 's1', name: 'LinkedIn' /* no key */ }], allow_free_entry: false },
    })
    const { result } = renderHook(() => useCustomerSources())
    await waitFor(() => expect(result.current.sources[0].key).toBe(null))
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
