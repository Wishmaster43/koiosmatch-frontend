/**
 * useCustomersData · per_page clamp (customers-500-leak) — the seam-harness
 * measured a REAL 422 on the archived quick-view: CustomerController::index caps
 * per_page at `between:1,200`, but a stored `default_per_page` preference of 500
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
  it('clamps a stored 500 preference to 200 on the plain list request', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/customers/stats' ? Promise.resolve({ data: { data: null } }) : Promise.resolve({ data: { data: [] } }))
    renderHook(() => useCustomersData({ filterParams: {}, page: 1, pageSize: 500, t }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers', expect.anything()))
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/customers')
    const params = call?.[1]?.params as { per_page?: number } | undefined
    expect(params?.per_page).toBe(CUSTOMERS_MAX_PER_PAGE)
    expect(params?.per_page).toBeLessThanOrEqual(200)
  })

  it('clamps a stored 500 preference to 200 on the archived quick-view request (the exact 422 the seam harness caught)', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/customers/stats' ? Promise.resolve({ data: { data: null } }) : Promise.resolve({ data: { data: [] } }))
    renderHook(() => useCustomersData({ filterParams: { include_archived: 1 }, page: 1, pageSize: 500, t }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers', expect.anything()))
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/customers')
    const params = call?.[1]?.params as { per_page?: number; include_archived?: number } | undefined
    // Both must hold at once — the archived param survives AND per_page stays capped.
    expect(params?.include_archived).toBe(1)
    expect(params?.per_page).toBe(CUSTOMERS_MAX_PER_PAGE)
    expect(params?.per_page).toBeLessThanOrEqual(200)
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
