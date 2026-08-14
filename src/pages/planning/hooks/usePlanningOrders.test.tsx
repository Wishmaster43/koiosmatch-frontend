/**
 * usePlanningOrders — PLANNING-ORDER-CREATE-1 regression tests. `api` is mocked;
 * per house rule (§13) these assert the REQUEST (method/route/body) the create
 * mutation actually sends, not just that a callback fired.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usePlanningOrdersList, useCreatePlanningOrder } from './usePlanningOrders'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  unwrap: (res: { data?: unknown }) => {
    const body = (res as { data?: unknown })?.data ?? res
    return (body && typeof body === 'object' && !Array.isArray(body) && 'data' in (body as object))
      ? (body as { data: unknown }).data
      : body
  },
  unwrapList: (res: { data?: unknown }) => {
    const body = (res as { data?: unknown })?.data ?? res
    const rows = Array.isArray(body) ? body : Array.isArray((body as { data?: unknown })?.data) ? (body as { data: unknown[] }).data : []
    return { rows, total: rows.length, page: 1, lastPage: 1, perPage: rows.length }
  },
}))

const mockedGet = vi.mocked(api.get)
const mockedPost = vi.mocked(api.post)
afterEach(() => vi.clearAllMocks())

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('usePlanningOrdersList', () => {
  it('GETs /planning/orders and maps rows', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 'o1', client: 'Rivas', status: 'open', shifts_count: 2 }] } })
    const { result } = renderHook(() => usePlanningOrdersList(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledWith('/planning/orders', expect.objectContaining({ params: { per_page: 100 } }))
    expect(result.current.orders).toEqual([{ id: 'o1', client: 'Rivas', status: 'open', shifts_count: 2 }])
  })
})

describe('useCreatePlanningOrder', () => {
  it('POSTs the exact order body to /planning/orders', async () => {
    mockedPost.mockResolvedValue({ data: { data: { id: 'o2', status: 'open' } } })
    const { result } = renderHook(() => useCreatePlanningOrder(), { wrapper })
    const body = { customer_id: 'c1', customer_location_id: null, function: 'Verzorgende IG', status: 'open' }
    await act(async () => { await result.current.mutateAsync(body) })
    expect(mockedPost).toHaveBeenCalledWith('/planning/orders', body)
  })
})
