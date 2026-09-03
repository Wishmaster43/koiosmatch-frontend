/**
 * usePlanningShifts — PLANNING-PERSIST-1-staart regression test. `api` is mocked;
 * per house rule (§13) this asserts the REQUEST (method/route/body) the create
 * mutation actually sends, not just that a callback fired.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCreatePlanningShift } from './usePlanningShifts'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  unwrap: (res: { data?: unknown }) => {
    const body = (res as { data?: unknown })?.data ?? res
    return (body && typeof body === 'object' && !Array.isArray(body) && 'data' in (body as object))
      ? (body as { data: unknown }).data
      : body
  },
}))

const mockedPost = vi.mocked(api.post)
afterEach(() => vi.clearAllMocks())

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useCreatePlanningShift', () => {
  it('POSTs the exact shift body, incl. notes, to /planning/shifts', async () => {
    mockedPost.mockResolvedValue({ data: { data: { id: 's1', planning_order_id: 'o1', status: 'planned' } } })
    const { result } = renderHook(() => useCreatePlanningShift(), { wrapper })
    const body = {
      planning_order_id: 'o1',
      customer_department_id: 'd1',
      function: 'Verzorgende IG',
      start_time: '2026-09-03T07:00:00',
      end_time: '2026-09-03T15:00:00',
      number_persons: 2,
      notes: 'Bring own scanner',
    }
    await act(async () => { await result.current.mutateAsync(body) })
    expect(mockedPost).toHaveBeenCalledWith('/planning/shifts', body)
  })

  it('invalidates the planning board query on success', async () => {
    mockedPost.mockResolvedValue({ data: { data: { id: 's2' } } })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    function localWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }
    const { result } = renderHook(() => useCreatePlanningShift(), { wrapper: localWrapper })
    await act(async () => { await result.current.mutateAsync({ planning_order_id: 'o1', start_time: '2026-09-03T07:00:00' }) })
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['planning', 'board'] }))
  })

  it('surfaces a validation failure to the caller', async () => {
    mockedPost.mockRejectedValue({ response: { status: 422, data: { message: 'The start time field is required.' } } })
    const { result } = renderHook(() => useCreatePlanningShift(), { wrapper })
    await expect(result.current.mutateAsync({ planning_order_id: 'o1', start_time: '' })).rejects.toMatchObject({
      response: { data: { message: 'The start time field is required.' } },
    })
  })
})
