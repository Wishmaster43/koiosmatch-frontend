/**
 * useApplicationSources — S-SOURCE-1. Covers: the DEFAULT seed while the fetch is
 * pending/empty, mapping the real `/applications/stats.by_source` distribution into
 * distinct option names (deduped, empties dropped), and `allowFreeEntry` always
 * being true (no tenant-CRUD lookup/toggle exists yet — see the hook's doc comment).
 * Each test uses a dedicated tenant id so useCachedLookup's module-scope cache never
 * leaks a mapped result between tests (mirrors useCachedLookup.test.ts's own convention).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api, { getActiveTenantId } from './api'
import { useApplicationSources, DEFAULT_APPLICATION_SOURCES } from './useApplicationSources'

vi.mock('./api', () => ({
  default: { get: vi.fn() },
  getActiveTenantId: vi.fn(() => null),
  unwrap: (res: { data?: { data?: unknown } }) => res?.data?.data ?? res?.data,
}))
const mockedGet = vi.mocked(api.get)
const mockedTenantId = vi.mocked(getActiveTenantId)
let tenantSeq = 0

afterEach(() => vi.clearAllMocks())

describe('useApplicationSources', () => {
  it('fetches /applications/stats and returns the seed while the request is pending', () => {
    mockedTenantId.mockReturnValue(`t${tenantSeq++}`)
    mockedGet.mockReturnValue(new Promise(() => {})) // never resolves
    const { result } = renderHook(() => useApplicationSources())
    expect(mockedGet).toHaveBeenCalledWith('/applications/stats', undefined)
    expect(result.current.sources).toEqual(DEFAULT_APPLICATION_SOURCES)
    expect(result.current.allowFreeEntry).toBe(true)
  })

  it('maps the distinct by_source names once the stats response resolves', async () => {
    mockedTenantId.mockReturnValue(`t${tenantSeq++}`)
    mockedGet.mockResolvedValue({
      data: { data: { by_source: [{ source: 'Indeed', count: 4 }, { source: 'LinkedIn', count: 2 }] } },
    })
    const { result } = renderHook(() => useApplicationSources())
    await waitFor(() => expect(result.current.sources).toEqual(['Indeed', 'LinkedIn']))
  })

  it('dedupes repeated source names and drops empty/null ones', async () => {
    mockedTenantId.mockReturnValue(`t${tenantSeq++}`)
    mockedGet.mockResolvedValue({
      data: { data: { by_source: [{ source: 'Indeed' }, { source: 'Indeed' }, { source: null }, { source: '' }] } },
    })
    const { result } = renderHook(() => useApplicationSources())
    await waitFor(() => expect(result.current.sources).toEqual(['Indeed']))
  })

  it('keeps the seed when by_source is empty (nothing usable in the response)', async () => {
    mockedTenantId.mockReturnValue(`t${tenantSeq++}`)
    mockedGet.mockResolvedValue({ data: { data: { by_source: [] } } })
    const { result } = renderHook(() => useApplicationSources())
    // Never resolves away from the seed since mapSources itself falls back.
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(result.current.sources).toEqual(DEFAULT_APPLICATION_SOURCES)
  })

  it('keeps the seed when the endpoint is unavailable (backend gap, not faked)', async () => {
    mockedTenantId.mockReturnValue(`t${tenantSeq++}`)
    mockedGet.mockRejectedValue(new Error('404'))
    const { result } = renderHook(() => useApplicationSources())
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(result.current.sources).toEqual(DEFAULT_APPLICATION_SOURCES)
  })
})
