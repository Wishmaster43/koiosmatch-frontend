/**
 * useVacanciesData · column sort (item 4, DATATABLE-SORT-1 reference adoption)
 * — pins the REQUEST shape (§13: assert the request, not just that a callback
 * fired) for the FE-column-keyed `sort` param this hook now accepts:
 *   - a mapped column (createdAt/applications) adds sort_by/sort_dir to the
 *     /vacancies list request;
 *   - the request never carries BOTH the new sort_by/sort_dir pair and the OLD
 *     `sort=status` param at once (they are two separate, independently-wired
 *     mechanisms — this test proves the new one never touches the old one);
 *   - no sort at all reproduces the exact pre-adoption request shape (no
 *     sort_by/sort_dir keys).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useVacanciesData, vacancySortParams } from './useVacanciesData'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
})

function listParams() {
  const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/vacancies')
  return call?.[1]?.params as Record<string, unknown> | undefined
}

describe('vacancySortParams — pure translation', () => {
  it('maps createdAt/applications to their backend sort_by field', () => {
    expect(vacancySortParams({ by: 'createdAt', dir: 'desc' })).toEqual({ sort_by: 'created_at', sort_dir: 'desc' })
    expect(vacancySortParams({ by: 'applications', dir: 'asc' })).toEqual({ sort_by: 'applications_count', sort_dir: 'asc' })
  })
  it('an unmapped column (e.g. title) never becomes a request param', () => {
    expect(vacancySortParams({ by: 'title', dir: 'asc' })).toEqual({})
  })
  it('no sort → no params at all', () => {
    expect(vacancySortParams(null)).toEqual({})
    expect(vacancySortParams(undefined)).toEqual({})
  })
})

describe('useVacanciesData · sort wired into the /vacancies request', () => {
  it('unsorted default: no sort_by/sort_dir on the request (byte-identical to before this change)', async () => {
    renderHook(() => useVacanciesData({ filterParams: {}, page: 1, pageSize: 25, t: ((k: string) => k) as unknown as Parameters<typeof useVacanciesData>[0]['t'], sort: null }), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(listParams()).not.toHaveProperty('sort_by')
    expect(listParams()).not.toHaveProperty('sort_dir')
  })

  it('a mapped column sends sort_by/sort_dir on the list request', async () => {
    renderHook(() => useVacanciesData({ filterParams: {}, page: 1, pageSize: 25, t: ((k: string) => k) as unknown as Parameters<typeof useVacanciesData>[0]['t'], sort: { by: 'createdAt', dir: 'desc' } }), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(listParams()).toMatchObject({ sort_by: 'created_at', sort_dir: 'desc' })
  })

  it('the new sort_by/sort_dir pair never collides with the OLD status sort param', async () => {
    renderHook(() => useVacanciesData({ filterParams: { sort: 'status' }, page: 1, pageSize: 25, t: ((k: string) => k) as unknown as Parameters<typeof useVacanciesData>[0]['t'], sort: { by: 'applications', dir: 'asc' } }), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    // Both survive, independently — the old param is untouched by the new mechanism.
    expect(listParams()).toMatchObject({ sort: 'status', sort_by: 'applications_count', sort_dir: 'asc' })
  })
})

// STATS-SCOPE-1 (2026-08-22 audit): the stats request must carry ONLY the view-scope
// subset of filterParams — never a dimension/attention filter — while the LIST request
// keeps receiving the full filterParams unchanged (§3B: KPI totals are server-wide).
describe('useVacanciesData · stats stays server-wide (STATS-SCOPE-1)', () => {
  const t = ((k: string) => k) as unknown as Parameters<typeof useVacanciesData>[0]['t']

  function statsParamsSent() {
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/vacancies/stats')
    return call?.[1]?.params as Record<string, unknown> | undefined
  }

  it('a dimension/attention filter (status/closing_soon) reaches the list but NOT the stats request', async () => {
    const filterParams = { status: ['open'], closing_soon: 1, owner_id: ['u1'] }
    renderHook(() => useVacanciesData({ filterParams, page: 1, pageSize: 25, t, sort: null }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/vacancies', expect.anything()))
    expect(listParams()).toMatchObject({ status: ['open'], closing_soon: 1, owner_id: ['u1'] })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/vacancies/stats', expect.anything()))
    expect(statsParamsSent()).toEqual({})
  })

  it('the archived view-scope flag reaches the stats request too', async () => {
    const filterParams = { include_archived: 1, category: ['nurse'] }
    renderHook(() => useVacanciesData({ filterParams, page: 1, pageSize: 25, t, sort: null }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/vacancies/stats', expect.anything()))
    expect(statsParamsSent()).toEqual({ include_archived: 1 })
  })

  it('changing only a dimension filter never re-fires the stats request (stable statsParams key)', async () => {
    const { rerender } = renderHook(
      ({ filterParams }) => useVacanciesData({ filterParams, page: 1, pageSize: 25, t, sort: null }),
      { wrapper, initialProps: { filterParams: { status: ['open'] } as Record<string, unknown> } },
    )
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/vacancies/stats', expect.anything()))
    const listCallsBefore  = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/vacancies').length
    const statsCallsBefore = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/vacancies/stats').length

    rerender({ filterParams: { status: ['closed'] } })
    await waitFor(() => {
      const listCallsAfter = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/vacancies').length
      expect(listCallsAfter).toBeGreaterThan(listCallsBefore)
    })
    const statsCallsAfter = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/vacancies/stats').length
    expect(statsCallsAfter).toBe(statsCallsBefore) // stats did not refetch — statsParams stayed {} both times
  })
})

// SELECT-RACE-1 (content-aware, REFRESH-FIX-2): rowsEpoch is the page's
// clear-selection trigger. It bumps ONLY when a settled list result carries a
// different row-id set than the previous settled one — never on the first rows
// (nothing selectable yet), never on a same-ids refetch (cache invalidation
// after a field edit, a window-focus refetch), never on a warm-cache mount, and
// never on a local setQueryData write (an optimistic bulk mutation).
describe('useVacanciesData · rowsEpoch (SELECT-RACE-1)', () => {
  const t = ((k: string) => k) as unknown as Parameters<typeof useVacanciesData>[0]['t']
  const listMock = (ids: () => number[]) =>
    vi.mocked(api.get).mockImplementation((url: string) =>
      url.endsWith('/stats') ? Promise.resolve({ data: { data: null } }) : Promise.resolve({ data: { data: ids().map(id => ({ id })) } }))
  const clientWrapper = (qc: QueryClient) => ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children)

  it('does NOT bump on the initial load: the first rows only seed the signature', async () => {
    listMock(() => [1])
    const { result } = renderHook(() => useVacanciesData({ filterParams: {}, page: 1, pageSize: 25, t, sort: null }), { wrapper: clientWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })) })
    await waitFor(() => expect(result.current.vacancies.length).toBe(1))
    await new Promise(r => setTimeout(r, 0))
    expect(result.current.rowsEpoch).toBe(0)
  })

  // The invariant bulk actions rely on: a SAME-IDS local write (a field edit on
  // rows already on the page) never bumps. A write that changes the id set
  // (archive removes a row, create prepends one) DOES bump — by design, rows
  // that left the page must not stay selected. Asserted after a flushed act,
  // never behind a bare setTimeout (Opus: that was a timing-fragile false green).
  it('CRITICAL GUARD: a same-ids optimistic setVacancies/setTotal write never bumps rowsEpoch', async () => {
    listMock(() => [1])
    const { result } = renderHook(() => useVacanciesData({ filterParams: {}, page: 1, pageSize: 25, t, sort: null }), { wrapper: clientWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })) })
    await waitFor(() => expect(result.current.vacancies.length).toBe(1))
    // Mirrors a bulk field mutation's optimistic update — same rows, new field values.
    await act(async () => { result.current.setVacancies(prev => prev.map(r => ({ ...r, touched: true }) as unknown as (typeof prev)[number])) })
    await act(async () => { result.current.setTotal(prev => prev) })
    await act(async () => {})
    expect(result.current.rowsEpoch).toBe(0)
  })

  it('bumps rowsEpoch when an optimistic write CHANGES the id set (rows leaving the page must not stay selected)', async () => {
    listMock(() => [1, 2])
    const { result } = renderHook(() => useVacanciesData({ filterParams: {}, page: 1, pageSize: 25, t, sort: null }), { wrapper: clientWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })) })
    await waitFor(() => expect(result.current.vacancies.length).toBe(2))
    // Mirrors a bulk archive's optimistic removal of one row.
    await act(async () => { result.current.setVacancies(prev => prev.filter(r => String(r.id) !== '2')) })
    await waitFor(() => expect(result.current.rowsEpoch).toBe(1))
  })

  it('bumps rowsEpoch when a settled refetch lands a DIFFERENT row set (new filterParams)', async () => {
    let n = 0
    listMock(() => [++n])
    const { result, rerender } = renderHook(
      ({ filterParams }) => useVacanciesData({ filterParams, page: 1, pageSize: 25, t, sort: null }),
      { wrapper: clientWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })), initialProps: { filterParams: { status: ['open'] } as Record<string, unknown> } },
    )
    await waitFor(() => expect(result.current.vacancies.length).toBe(1))
    rerender({ filterParams: { status: ['closed'] } })
    await waitFor(() => expect(result.current.rowsEpoch).toBe(1))
  })

  it('does NOT bump when a refetch resolves the same row set (invalidate / focus)', async () => {
    listMock(() => [1])
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useVacanciesData({ filterParams: {}, page: 1, pageSize: 25, t, sort: null }), { wrapper: clientWrapper(qc) })
    await waitFor(() => expect(result.current.vacancies.length).toBe(1))
    const calls = vi.mocked(api.get).mock.calls.length
    await act(async () => { await qc.invalidateQueries() })
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(calls))
    await new Promise(r => setTimeout(r, 0))
    expect(result.current.rowsEpoch).toBe(0)
  })

  // Opus B1: a WARM-CACHE mount (fresh list in the cache, no mount fetch) must
  // seed the signature from the cached rows, so the first later refetch with the
  // same ids does not wipe a selection made in the meantime.
  it('does NOT bump on the first refetch after a warm-cache mount', async () => {
    listMock(() => [1])
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })
    qc.setQueryData(['vacancies', {}, 1, 25, null], { vacancies: [{ id: 1 }], total: 1, lastPage: 1 })
    const { result } = renderHook(() => useVacanciesData({ filterParams: {}, page: 1, pageSize: 25, t, sort: null }), { wrapper: clientWrapper(qc) })
    await waitFor(() => expect(result.current.vacancies.length).toBe(1))
    await new Promise(r => setTimeout(r, 0))
    expect(result.current.rowsEpoch).toBe(0)
    await act(async () => { await qc.invalidateQueries() })
    await waitFor(() => expect(result.current.vacancies.length).toBe(1))
    await new Promise(r => setTimeout(r, 0))
    expect(result.current.rowsEpoch).toBe(0)
  })
})
