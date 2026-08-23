/**
 * useCustomersData · per_page clamp (customers-500-leak) — the seam-harness
 * measured a REAL 422 on the archived quick-view: CustomerController::index caps
 * per_page at `between:1,500`, but a stored `default_per_page` preference of 500
 * (the seeded/profile default, see useProfileForm.ts) reached the outgoing request
 * unclamped. useListPageSize already clamps what CustomersPage PASSES IN, but this
 * hook's own queryFn is the last line of defense (the "defensive re-clamp" comment
 * next to CUSTOMERS_MAX_PER_PAGE) — this test pins that defense at the REQUEST
 * level (§13: assert the request, not just that a callback fired), for both the
 * plain list and the include_archived=1 (archived quick-view) path, since that is
 * the exact combination the seam harness caught firing per_page=500.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useCustomersData, CUSTOMERS_MAX_PER_PAGE } from './useCustomersData'

// Stub only the axios-like client; unwrap/unwrapList stay real (pure helpers).
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

const t = ((k: string) => k) as unknown as import('i18next').TFunction

beforeEach(() => vi.clearAllMocks())

describe('useCustomersData · per_page never exceeds the endpoint cap', () => {
  it('clamps a stored 900 preference to 500 on the plain list request', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/customers/stats' ? Promise.resolve({ data: { data: null } }) : Promise.resolve({ data: { data: [] } }))
    renderHook(() => useCustomersData({ filterParams: {}, page: 1, pageSize: 500, t }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers', expect.anything()))
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/customers')
    const params = call?.[1]?.params as { per_page?: number } | undefined
    expect(params?.per_page).toBe(CUSTOMERS_MAX_PER_PAGE)
    expect(params?.per_page).toBeLessThanOrEqual(500)
  })

  it('clamps a stored 900 preference to 500 on the archived quick-view request (the exact 422 the seam harness caught)', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/customers/stats' ? Promise.resolve({ data: { data: null } }) : Promise.resolve({ data: { data: [] } }))
    renderHook(() => useCustomersData({ filterParams: { include_archived: 1 }, page: 1, pageSize: 500, t }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers', expect.anything()))
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/customers')
    const params = call?.[1]?.params as { per_page?: number; include_archived?: number } | undefined
    // Both must hold at once — the archived param survives AND per_page stays capped.
    expect(params?.include_archived).toBe(1)
    expect(params?.per_page).toBe(CUSTOMERS_MAX_PER_PAGE)
    expect(params?.per_page).toBeLessThanOrEqual(500)
  })

  it('passes a pageSize already within the cap through unchanged', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/customers/stats' ? Promise.resolve({ data: { data: null } }) : Promise.resolve({ data: { data: [] } }))
    renderHook(() => useCustomersData({ filterParams: {}, page: 1, pageSize: 100, t }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers', expect.anything()))
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/customers')
    const params = call?.[1]?.params as { per_page?: number } | undefined
    expect(params?.per_page).toBe(100)
  })
})

// STATS-SCOPE-1 (2026-08-22 audit): the stats request must carry ONLY the view-scope
// subset of filterParams — never a dimension filter — while the LIST request keeps
// receiving the full filterParams unchanged (§3B: KPI totals are server-wide).
describe('useCustomersData · stats stays server-wide (STATS-SCOPE-1)', () => {
  function statsParamsSent() {
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/customers/stats')
    return call?.[1]?.params as Record<string, unknown> | undefined
  }

  it('a dimension filter (status/owner_id) reaches the list but NOT the stats request', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/customers/stats' ? Promise.resolve({ data: { data: null } }) : Promise.resolve({ data: { data: [] } }))
    const filterParams = { status: ['active'], owner_id: ['u1'], search: 'acme' }
    renderHook(() => useCustomersData({ filterParams, page: 1, pageSize: 25, t }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers', expect.anything()))
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/customers')
    const listParams = call?.[1]?.params as Record<string, unknown> | undefined
    expect(listParams).toMatchObject({ status: ['active'], owner_id: ['u1'], search: 'acme' })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers/stats', expect.anything()))
    expect(statsParamsSent()).toEqual({})
  })

  it('the archived view-scope flag reaches the stats request too', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/customers/stats' ? Promise.resolve({ data: { data: null } }) : Promise.resolve({ data: { data: [] } }))
    const filterParams = { include_archived: 1, industry: ['zorg'] }
    renderHook(() => useCustomersData({ filterParams, page: 1, pageSize: 25, t }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers/stats', expect.anything()))
    expect(statsParamsSent()).toEqual({ include_archived: 1 })
  })

  it('changing only a dimension filter never re-fires the stats request (stable statsParams key)', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/customers/stats' ? Promise.resolve({ data: { data: null } }) : Promise.resolve({ data: { data: [] } }))
    const { rerender } = renderHook(
      ({ filterParams }) => useCustomersData({ filterParams, page: 1, pageSize: 25, t }),
      { wrapper, initialProps: { filterParams: { status: ['active'] } as Record<string, unknown> } },
    )
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers/stats', expect.anything()))
    const listCallsBefore  = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/customers').length
    const statsCallsBefore = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/customers/stats').length

    rerender({ filterParams: { status: ['inactive'] } })
    await waitFor(() => {
      const listCallsAfter = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/customers').length
      expect(listCallsAfter).toBeGreaterThan(listCallsBefore)
    })
    const statsCallsAfter = vi.mocked(api.get).mock.calls.filter(([url]) => url === '/customers/stats').length
    expect(statsCallsAfter).toBe(statsCallsBefore) // stats did not refetch — statsParams stayed {} both times
  })
})

// SELECT-RACE-1 (content-aware, REFRESH-FIX-2): rowsEpoch is the page's
// clear-selection trigger. It bumps ONLY when a settled list result carries a
// different row-id set than the previous settled one — never on the first rows
// (nothing selectable yet), never on a same-ids refetch (cache invalidation
// after a field edit, a window-focus refetch), never on a warm-cache mount, and
// never on a local setQueryData write (an optimistic bulk mutation).
describe('useCustomersData · rowsEpoch (SELECT-RACE-1)', () => {
  const listMock = (ids: () => number[]) =>
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/customers/stats' ? Promise.resolve({ data: { data: null } }) : Promise.resolve({ data: { data: ids().map(id => ({ id })) } }))
  const clientWrapper = (qc: QueryClient) => ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children)

  it('does NOT bump on the initial load: the first rows only seed the signature', async () => {
    listMock(() => [1])
    const { result } = renderHook(() => useCustomersData({ filterParams: {}, page: 1, pageSize: 25, t }), { wrapper: clientWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })) })
    await waitFor(() => expect(result.current.customers.length).toBe(1))
    await new Promise(r => setTimeout(r, 0))
    expect(result.current.rowsEpoch).toBe(0)
  })

  // The invariant bulk actions rely on: a SAME-IDS local write (a field edit on
  // rows already on the page) never bumps. A write that changes the id set
  // (archive removes a row, create prepends one) DOES bump — by design, rows
  // that left the page must not stay selected. Asserted after a flushed act,
  // never behind a bare setTimeout (Opus: that was a timing-fragile false green).
  it('CRITICAL GUARD: a same-ids optimistic setCustomers/setTotal write never bumps rowsEpoch', async () => {
    listMock(() => [1])
    const { result } = renderHook(() => useCustomersData({ filterParams: {}, page: 1, pageSize: 25, t }), { wrapper: clientWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })) })
    await waitFor(() => expect(result.current.customers.length).toBe(1))
    // Mirrors a bulk field mutation's optimistic update — same rows, new field values.
    await act(async () => { result.current.setCustomers(prev => prev.map(r => ({ ...r, touched: true }) as unknown as (typeof prev)[number])) })
    await act(async () => { result.current.setTotal(prev => prev) })
    await act(async () => {})
    expect(result.current.rowsEpoch).toBe(0)
  })

  it('bumps rowsEpoch when an optimistic write CHANGES the id set (rows leaving the page must not stay selected)', async () => {
    listMock(() => [1, 2])
    const { result } = renderHook(() => useCustomersData({ filterParams: {}, page: 1, pageSize: 25, t }), { wrapper: clientWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })) })
    await waitFor(() => expect(result.current.customers.length).toBe(2))
    // Mirrors a bulk archive's optimistic removal of one row.
    await act(async () => { result.current.setCustomers(prev => prev.filter(r => String(r.id) !== '2')) })
    await waitFor(() => expect(result.current.rowsEpoch).toBe(1))
  })

  it('bumps rowsEpoch when a settled refetch lands a DIFFERENT row set (new filterParams)', async () => {
    let n = 0
    listMock(() => [++n])
    const { result, rerender } = renderHook(
      ({ filterParams }) => useCustomersData({ filterParams, page: 1, pageSize: 25, t }),
      { wrapper: clientWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })), initialProps: { filterParams: { status: ['active'] } as Record<string, unknown> } },
    )
    await waitFor(() => expect(result.current.customers.length).toBe(1))
    rerender({ filterParams: { status: ['inactive'] } })
    await waitFor(() => expect(result.current.rowsEpoch).toBe(1))
  })

  it('does NOT bump when a refetch resolves the same row set (invalidate / focus)', async () => {
    listMock(() => [1])
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useCustomersData({ filterParams: {}, page: 1, pageSize: 25, t }), { wrapper: clientWrapper(qc) })
    await waitFor(() => expect(result.current.customers.length).toBe(1))
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
    qc.setQueryData(['customers', {}, 1, 25], { customers: [{ id: 1 }], total: 1, lastPage: 1 })
    const { result } = renderHook(() => useCustomersData({ filterParams: {}, page: 1, pageSize: 25, t }), { wrapper: clientWrapper(qc) })
    await waitFor(() => expect(result.current.customers.length).toBe(1))
    await new Promise(r => setTimeout(r, 0))
    expect(result.current.rowsEpoch).toBe(0)
    await act(async () => { await qc.invalidateQueries() })
    await waitFor(() => expect(result.current.customers.length).toBe(1))
    await new Promise(r => setTimeout(r, 0))
    expect(result.current.rowsEpoch).toBe(0)
  })
})
