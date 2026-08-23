/**
 * useApplicationsData · DATATABLE-SORT-1 reference adoption — pins the REQUEST
 * shape (§13: assert the request, not just that a callback fired) for the
 * FE-column-keyed `sort` param this hook now accepts:
 *   - a mapped column (e.g. "created") must add sort_by/sort_dir to BOTH the
 *     list and the wide query (the task's explicit "list + wide queries");
 *   - an UNMAPPED column (e.g. "vacancy" — not in ApplicationQuery::SORTS) must
 *     never leak a sort_by/sort_dir the backend would 422 on;
 *   - no sort at all reproduces the EXACT pre-adoption request shape (no
 *     sort_by/sort_dir keys at all) — the "unsorted default unchanged" guard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useApplicationsData } from './useApplicationsData'

// Stub only the axios-like client; unwrap/unwrapList stay real (pure helpers).
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

// Pull the params object the hook sent for a specific /applications call —
// there are two (list + wide) in flight per render, so filter by an
// unambiguous marker each test sets (per_page differs: list uses pageSize,
// wide always uses the 500 ceiling).
function paramsFor(perPage: number) {
  const call = vi.mocked(api.get).mock.calls.find(([url, cfg]) =>
    url === '/applications' && (cfg as { params?: { per_page?: number } })?.params?.per_page === perPage)
  return call?.[1]?.params as Record<string, unknown> | undefined
}

describe('useApplicationsData · sort request shape (DATATABLE-SORT-1)', () => {
  it('unsorted default: no sort_by/sort_dir on either query (byte-identical to before this change)', async () => {
    renderHook(() => useApplicationsData({
      view: 'table', filterParams: {}, page: 1, pageSize: 25, funnelTypes: [], sort: null,
    }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/applications', expect.anything()))
    const listParams = paramsFor(25)
    const wideParams = paramsFor(500)
    expect(listParams).not.toHaveProperty('sort_by')
    expect(listParams).not.toHaveProperty('sort_dir')
    expect(wideParams).not.toHaveProperty('sort_by')
    expect(wideParams).not.toHaveProperty('sort_dir')
  })

  it('a column mapped to a real backend field sends sort_by/sort_dir on BOTH the list and the wide query', async () => {
    renderHook(() => useApplicationsData({
      view: 'table', filterParams: {}, page: 1, pageSize: 25, funnelTypes: [],
      sort: { by: 'created', dir: 'desc' },
    }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/applications', expect.anything()))
    const listParams = paramsFor(25)
    const wideParams = paramsFor(500)
    expect(listParams).toMatchObject({ sort_by: 'created_at', sort_dir: 'desc' })
    expect(wideParams).toMatchObject({ sort_by: 'created_at', sort_dir: 'desc' })
  })

  it('an unmapped FE column key never reaches the request as sort_by/sort_dir (would 422 the whitelist)', async () => {
    renderHook(() => useApplicationsData({
      view: 'table', filterParams: {}, page: 1, pageSize: 25, funnelTypes: [],
      sort: { by: 'vacancy', dir: 'asc' },
    }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/applications', expect.anything()))
    const listParams = paramsFor(25)
    const wideParams = paramsFor(500)
    expect(listParams).not.toHaveProperty('sort_by')
    expect(listParams).not.toHaveProperty('sort_dir')
    expect(wideParams).not.toHaveProperty('sort_by')
    expect(wideParams).not.toHaveProperty('sort_dir')
  })

  it('maps every column the reference adoption wires (candidate/score/phase), one request per key', async () => {
    const cases: Array<[string, string]> = [
      ['candidate', 'candidate_last_name'],
      ['score', 'match_score'],
      ['phase', 'stage_order'],
    ]
    for (const [by, sortBy] of cases) {
      vi.clearAllMocks()
      vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
      renderHook(() => useApplicationsData({
        view: 'table', filterParams: {}, page: 1, pageSize: 25, funnelTypes: [],
        sort: { by, dir: 'asc' },
      }), { wrapper })

      await waitFor(() => expect(api.get).toHaveBeenCalledWith('/applications', expect.anything()))
      expect(paramsFor(25)).toMatchObject({ sort_by: sortBy, sort_dir: 'asc' })
    }
  })
})

// STATS-SCOPE-1 (2026-08-22 audit): the stats request must carry ONLY the view-scope
// subset of filterParams — never a dimension/attention filter — while the list/wide
// requests keep receiving the full filterParams unchanged (§3B: KPI totals are
// server-wide).
describe('useApplicationsData · stats stays server-wide (STATS-SCOPE-1)', () => {
  function statsParamsSent() {
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/applications/stats')
    return call?.[1]?.params as Record<string, unknown> | undefined
  }

  it('a dimension/attention filter (too_long_in_stage) reaches list/wide but NOT stats', async () => {
    const filterParams = { too_long_in_stage: 1, phase_key: ['applied'], owner_id: ['u1'] }
    renderHook(() => useApplicationsData({
      view: 'table', filterParams, page: 1, pageSize: 25, funnelTypes: [], sort: null,
    }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/applications', expect.anything()))
    expect(paramsFor(25)).toMatchObject({ too_long_in_stage: 1, phase_key: ['applied'], owner_id: ['u1'] })
    expect(paramsFor(500)).toMatchObject({ too_long_in_stage: 1, phase_key: ['applied'], owner_id: ['u1'] })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/applications/stats', expect.anything()))
    expect(statsParamsSent()).toEqual({})
  })

  it('the archived view-scope flag reaches the stats request too', async () => {
    const filterParams = { include_archived: 1, source: ['website'] }
    renderHook(() => useApplicationsData({
      view: 'table', filterParams, page: 1, pageSize: 25, funnelTypes: [], sort: null,
    }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/applications/stats', expect.anything()))
    expect(statsParamsSent()).toEqual({ include_archived: 1 })
  })

  it('changing only a dimension filter never re-fires the stats request (stable statsParams key)', async () => {
    const { rerender } = renderHook(
      ({ filterParams }) => useApplicationsData({ view: 'table', filterParams, page: 1, pageSize: 25, funnelTypes: [], sort: null }),
      { wrapper, initialProps: { filterParams: { source: ['website'] } as Record<string, unknown> } },
    )
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/applications/stats', expect.anything()))
    const listCallsBefore  = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/applications').length
    const statsCallsBefore = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/applications/stats').length

    rerender({ filterParams: { source: ['referral'] } })
    await waitFor(() => {
      const listCallsAfter = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/applications').length
      expect(listCallsAfter).toBeGreaterThan(listCallsBefore) // list + wide both refetch on the new dimension value
    })
    const statsCallsAfter = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/applications/stats').length
    expect(statsCallsAfter).toBe(statsCallsBefore) // stats did not refetch — statsParams stayed {} both times
  })
})

// SELECT-RACE-1 (content-aware, REFRESH-FIX-2): rowsEpoch is the page's
// clear-selection trigger. It bumps ONLY when a settled list result carries a
// different row-id set than the previous settled one — never on the first rows
// (nothing selectable yet), never on a same-ids refetch (cache invalidation
// after a field edit, a window-focus refetch), never on a warm-cache mount, and
// never on a local setQueryData write (an optimistic bulk mutation).
describe('useApplicationsData · rowsEpoch (SELECT-RACE-1)', () => {
  const listMock = (ids: () => number[]) =>
    vi.mocked(api.get).mockImplementation((url: string) =>
      url.endsWith('/stats') ? Promise.resolve({ data: { data: null } }) : Promise.resolve({ data: { data: ids().map(id => ({ id })) } }))
  const clientWrapper = (qc: QueryClient) => ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children)

  it('does NOT bump on the initial load: the first rows only seed the signature', async () => {
    listMock(() => [1])
    const { result } = renderHook(() => useApplicationsData({ view: 'table', filterParams: {}, page: 1, pageSize: 25, funnelTypes: [], sort: null }), { wrapper: clientWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })) })
    await waitFor(() => expect(result.current.applications.length).toBe(1))
    await new Promise(r => setTimeout(r, 0))
    expect(result.current.rowsEpoch).toBe(0)
  })

  // The invariant bulk actions rely on: a SAME-IDS local write (a field edit on
  // rows already on the page) never bumps. A write that changes the id set
  // (archive removes a row, create prepends one) DOES bump — by design, rows
  // that left the page must not stay selected. Asserted after a flushed act,
  // never behind a bare setTimeout (Opus: that was a timing-fragile false green).
  it('CRITICAL GUARD: a same-ids optimistic setApplications/setTotal write never bumps rowsEpoch', async () => {
    listMock(() => [1])
    const { result } = renderHook(() => useApplicationsData({ view: 'table', filterParams: {}, page: 1, pageSize: 25, funnelTypes: [], sort: null }), { wrapper: clientWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })) })
    await waitFor(() => expect(result.current.applications.length).toBe(1))
    // Mirrors a bulk field mutation's optimistic update — same rows, new field values.
    await act(async () => { result.current.setApplications(prev => prev.map(r => ({ ...r, touched: true }) as unknown as (typeof prev)[number])) })
    await act(async () => { result.current.setTotal(prev => prev) })
    await act(async () => {})
    expect(result.current.rowsEpoch).toBe(0)
  })

  it('bumps rowsEpoch when an optimistic write CHANGES the id set (rows leaving the page must not stay selected)', async () => {
    listMock(() => [1, 2])
    const { result } = renderHook(() => useApplicationsData({ view: 'table', filterParams: {}, page: 1, pageSize: 25, funnelTypes: [], sort: null }), { wrapper: clientWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })) })
    await waitFor(() => expect(result.current.applications.length).toBe(2))
    // Mirrors a bulk archive's optimistic removal of one row.
    await act(async () => { result.current.setApplications(prev => prev.filter(r => String(r.id) !== '2')) })
    await waitFor(() => expect(result.current.rowsEpoch).toBe(1))
  })

  it('bumps rowsEpoch when a settled refetch lands a DIFFERENT row set (new filterParams)', async () => {
    let n = 0
    listMock(() => [++n])
    const { result, rerender } = renderHook(
      ({ filterParams }) => useApplicationsData({ view: 'table', filterParams, page: 1, pageSize: 25, funnelTypes: [], sort: null }),
      { wrapper: clientWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })), initialProps: { filterParams: { source: ['website'] } as Record<string, unknown> } },
    )
    await waitFor(() => expect(result.current.applications.length).toBe(1))
    rerender({ filterParams: { source: ['referral'] } })
    await waitFor(() => expect(result.current.rowsEpoch).toBe(1))
  })

  it('does NOT bump when a refetch resolves the same row set (invalidate / focus)', async () => {
    listMock(() => [1])
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useApplicationsData({ view: 'table', filterParams: {}, page: 1, pageSize: 25, funnelTypes: [], sort: null }), { wrapper: clientWrapper(qc) })
    await waitFor(() => expect(result.current.applications.length).toBe(1))
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
    qc.setQueryData(['applications', 'list', {}, undefined, 1, 25, null], { applications: [{ id: 1 }], total: 1, lastPage: 1 })
    const { result } = renderHook(() => useApplicationsData({ view: 'table', filterParams: {}, page: 1, pageSize: 25, funnelTypes: [], sort: null }), { wrapper: clientWrapper(qc) })
    await waitFor(() => expect(result.current.applications.length).toBe(1))
    await new Promise(r => setTimeout(r, 0))
    expect(result.current.rowsEpoch).toBe(0)
    await act(async () => { await qc.invalidateQueries() })
    await waitFor(() => expect(result.current.applications.length).toBe(1))
    await new Promise(r => setTimeout(r, 0))
    expect(result.current.rowsEpoch).toBe(0)
  })
})
