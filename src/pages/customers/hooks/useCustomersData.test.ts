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
import { renderHook, waitFor } from '@testing-library/react'
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
