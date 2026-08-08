/**
 * useEscalationReasons — LOOKUP-GAP-1(c) regression tests. `api`/`getActiveTenantId`
 * are mocked (this hook is built on useCachedLookup's module-scope cache, mirrors
 * useCachedLookup.test.ts); each test mocks its own tenant id so the shared cache
 * never leaks a value across tests within this file (same convention as
 * useCachedLookup.test.ts's tenant-scoping block).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api, { getActiveTenantId } from '@/lib/api'
import { useEscalationReasons, DEFAULT_ESCALATION_REASONS } from './useEscalationReasons'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  getActiveTenantId: vi.fn(() => null),
  unwrapList: (res: { data?: unknown }) => {
    const body = (res as { data?: unknown })?.data ?? res
    const rows = Array.isArray(body) ? body : Array.isArray((body as { data?: unknown })?.data) ? (body as { data: unknown[] }).data : []
    return { rows, total: rows.length, page: 1, lastPage: 1, perPage: rows.length }
  },
}))

const mockedGet = vi.mocked(api.get)
const mockedTenantId = vi.mocked(getActiveTenantId)
let tenantCounter = 0
// A fresh tenant id per test keeps each render on its OWN useCachedLookup cache
// slot (`${tenantId}:/escalation-reasons`) so tests never read a prior test's cache.
const freshTenant = () => mockedTenantId.mockReturnValue(`t-${++tenantCounter}`)

afterEach(() => vi.clearAllMocks())

describe('useEscalationReasons', () => {
  it('fetches GET /escalation-reasons and maps id/name/color to the shared LookupOption shape', async () => {
    freshTenant()
    // eslint-disable-next-line no-restricted-syntax -- DATA: a mock API row's tenant colour, not an invented UI colour
    mockedGet.mockResolvedValue({ data: [{ id: 'r1', name: 'Klacht', color: '#123456', sort_order: 0, in_use: true }] })
    const { result } = renderHook(() => useEscalationReasons())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledWith('/escalation-reasons', undefined)
    // eslint-disable-next-line no-restricted-syntax -- DATA: asserting against the mock row's colour above
    expect(result.current.reasons).toEqual([{ value: 'r1', label: 'Klacht', color: '#123456' }])
  })

  it('falls back to the seed defaults on a failed fetch (no fabricated colours)', async () => {
    freshTenant()
    mockedGet.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useEscalationReasons())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.reasons).toEqual(DEFAULT_ESCALATION_REASONS)
  })

  it('falls back to the seed defaults on an empty list (tenant has no reasons yet)', async () => {
    freshTenant()
    mockedGet.mockResolvedValue({ data: [] })
    const { result } = renderHook(() => useEscalationReasons())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.reasons).toEqual(DEFAULT_ESCALATION_REASONS)
  })

  it('metaOf resolves a REAL tenant reason by id or by name — not from a literal map', async () => {
    freshTenant()
    // eslint-disable-next-line no-restricted-syntax -- DATA: a mock API row's tenant colour, not an invented UI colour
    mockedGet.mockResolvedValue({ data: [{ id: 'r9', name: 'Klacht', color: '#00AAFF' }] })
    const { result } = renderHook(() => useEscalationReasons())
    await waitFor(() => expect(result.current.loading).toBe(false))
    // eslint-disable-next-line no-restricted-syntax -- DATA: asserting against the mock row's colour above
    const expected = { value: 'r9', label: 'Klacht', color: '#00AAFF' }
    expect(result.current.metaOf('r9')).toEqual(expected)
    expect(result.current.metaOf('Klacht')).toEqual(expected)
    expect(result.current.metaOf('unknown-value')).toBeUndefined()
  })
})
