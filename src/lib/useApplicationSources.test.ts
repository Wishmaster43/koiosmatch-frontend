/**
 * useApplicationSources — S-SOURCE-1 GRADUATION (2026-08-14). Covers: the REAL
 * request goes to `GET /candidate-sources` (not the old `/applications/stats`
 * interim), the DEFAULT seed while the fetch is pending/empty, mapping the real
 * lookup rows into distinct option names, `allowFreeEntry` reading straight off
 * THIS response's own flag (no second, disconnected settings-blob key — see the
 * hook's own doc comment for why), and `invalidate` being exposed for the
 * settings screen. Each test uses a dedicated tenant id so useCachedLookup's
 * module-scope cache never leaks a mapped result between tests (mirrors
 * useCachedLookup.test.ts's own convention).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api, { getActiveTenantId } from './api'
import { useApplicationSources, DEFAULT_APPLICATION_SOURCES } from './useApplicationSources'

vi.mock('./api', () => ({
  default: { get: vi.fn() },
  getActiveTenantId: vi.fn(() => null),
  unwrapList: (res: { data?: { data?: unknown[] } }) =>
    ({ rows: res?.data?.data ?? [], total: 0, page: 1, lastPage: 1, perPage: 0 }),
}))
const mockedGet = vi.mocked(api.get)
const mockedTenantId = vi.mocked(getActiveTenantId)
let tenantSeq = 0

// LOOKUP-I18N-1: `sources` is `{ value, label }[]`, not a bare string[] — value is
// the untranslated backend name, label the (possibly translated) display text. This
// test suite never initialises react-i18next, so `t(key, { defaultValue })` falls
// back to `defaultValue` verbatim, i.e. label === value here (real-locale translation
// is covered by lookupSeedI18n.test.ts, the pure helper's own suite).
const asOptions = (names: string[]) => names.map(name => ({ value: name, label: name }))

// A fresh tenant id per test isolates useCachedLookup's module-scope cache.
const nextTenant = () => `t${tenantSeq++}`

afterEach(() => vi.clearAllMocks())

describe('useApplicationSources', () => {
  it('GETs the REAL /candidate-sources lookup route (never the old stats endpoint)', () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockReturnValue(new Promise(() => {})) // never resolves
    renderHook(() => useApplicationSources())
    expect(mockedGet).toHaveBeenCalledWith('/candidate-sources', undefined)
    expect(mockedGet).not.toHaveBeenCalledWith('/applications/stats', expect.anything())
  })

  // FREE-ENTRY-FALLBACK-1: pending means PERMISSIVE, never strict. Strict-while-unknown
  // reads as "no value is valid" and locks the user out of a required field for a reason
  // they cannot see. The backend hit exactly this on 15-08 with an empty lookup table and
  // answered 422 on four write paths; both sides now default permissive.
  it('returns the seed and stays permissive while the request is pending', () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useApplicationSources())
    expect(result.current.sources).toEqual(asOptions(DEFAULT_APPLICATION_SOURCES))
    expect(result.current.allowFreeEntry).toBe(true)
  })

  // The mirror case: a failed request must not silently turn the picker strict either.
  it('stays permissive when the request fails outright', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useApplicationSources())
    await waitFor(() => expect(result.current.sources).toEqual(asOptions(DEFAULT_APPLICATION_SOURCES)))
    expect(result.current.allowFreeEntry).toBe(true)
  })

  it('maps the distinct lookup row names once the response resolves', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockResolvedValue({
      data: { data: [{ id: 's1', name: 'Indeed' }, { id: 's2', name: 'LinkedIn' }], allow_free_entry: false },
    })
    const { result } = renderHook(() => useApplicationSources())
    await waitFor(() => expect(result.current.sources).toEqual(asOptions(['Indeed', 'LinkedIn'])))
  })

  it('keeps the seed when the lookup is empty (nothing usable in the response)', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockResolvedValue({ data: { data: [], allow_free_entry: false } })
    const { result } = renderHook(() => useApplicationSources())
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(result.current.sources).toEqual(asOptions(DEFAULT_APPLICATION_SOURCES))
  })

  it('keeps the seed when the endpoint is unavailable (network/404)', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockRejectedValue(new Error('404'))
    const { result } = renderHook(() => useApplicationSources())
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(result.current.sources).toEqual(asOptions(DEFAULT_APPLICATION_SOURCES))
  })

  it('honours a false allow_free_entry from the API (the backend default: strict, clean data for the Sources report)', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockResolvedValue({ data: { data: [{ id: 's1', name: 'Indeed' }], allow_free_entry: false } })
    const { result } = renderHook(() => useApplicationSources())
    await waitFor(() => expect(result.current.allowFreeEntry).toBe(false))
  })

  it('honours a true allow_free_entry from the API once a tenant turns it on', async () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockResolvedValue({ data: { data: [{ id: 's1', name: 'Indeed' }], allow_free_entry: true } })
    const { result } = renderHook(() => useApplicationSources())
    await waitFor(() => expect(result.current.allowFreeEntry).toBe(true))
  })

  it('exposes invalidate() so the settings screen can force a refetch after a free-entry change', () => {
    mockedTenantId.mockReturnValue(nextTenant())
    mockedGet.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useApplicationSources())
    expect(typeof result.current.invalidate).toBe('function')
  })
})
