/**
 * usePlanningBoard — read-side regression tests. Asserts the REQUEST (route +
 * params) sent to GET /planning/board and that the flatten step maps the real
 * PlanningBoardBuilder response shape (snake_case, day/group-nested) onto the
 * flat row shape this screen's views render — never a fabricated field.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usePlanningBoard } from './usePlanningBoard'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  unwrap: (res: { data?: unknown }) => (res as { data?: unknown })?.data ?? res,
}))

const mockedGet = vi.mocked(api.get)
afterEach(() => vi.clearAllMocks())

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('usePlanningBoard', () => {
  it('requests GET /planning/board with the given from/to window', async () => {
    mockedGet.mockResolvedValue({ data: { from: '2026-08-01T00:00:00+02:00', to: '2026-08-31T00:00:00+02:00', days: [], meta: { total_shifts: 0, open_shifts: 0 } } })
    renderHook(() => usePlanningBoard('2026-08-01', '2026-08-31'), { wrapper })
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/planning/board', {
      params: { from: '2026-08-01', to: '2026-08-31' }, signal: expect.anything(),
    }))
  })

  it('flattens days/groups/shifts into a flat row list with the group location attached', async () => {
    mockedGet.mockResolvedValue({
      data: {
        from: '2026-08-14', to: '2026-08-14',
        days: [{
          date: '2026-08-14',
          groups: [{
            customer_id: 'cust-1', customer: 'Rivas Zorggroep',
            customer_location_id: null, location: null,
            shifts: [{
              id: 'sh-1', planning_order_id: 'ord-1', function: 'Verzorgende IG', shift_type: 'day',
              start_time: '2026-08-14T07:00:00+02:00', end_time: '2026-08-14T15:00:00+02:00',
              status: 'open', number_persons: 2, scheduled_count: 1, open_spots: 1, open_shift: true,
              assigned: [{ schedule_id: 'sc-1', candidate_id: 'cand-1', candidate: 'Ismail Eddahchouri', status: 'planned' }],
            }],
          }],
        }],
        meta: { total_shifts: 1, open_shifts: 1 },
      },
    })
    const { result } = renderHook(() => usePlanningBoard('2026-08-14', '2026-08-14'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
    expect(result.current.shifts).toEqual([{
      id: 'sh-1', planningOrderId: 'ord-1', function: 'Verzorgende IG', shiftType: 'day',
      startTime: '2026-08-14T07:00:00+02:00', endTime: '2026-08-14T15:00:00+02:00',
      status: 'open', numberPersons: 2, scheduledCount: 1, openSpots: 1, openShift: true,
      assigned: [{ scheduleId: 'sc-1', candidateId: 'cand-1', candidate: 'Ismail Eddahchouri', status: 'planned' }],
      customerId: 'cust-1', customer: 'Rivas Zorggroep', customerLocationId: null, location: null,
    }])
  })

  it('reports the error state on a rejected request (no fabricated fallback)', async () => {
    mockedGet.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => usePlanningBoard('2026-08-01', '2026-08-31'), { wrapper })
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.shifts).toEqual([])
  })

  it('returns a stable empty-array reference before data resolves (no infinite-render footgun)', () => {
    mockedGet.mockResolvedValue({ data: { days: [] } })
    const { result, rerender } = renderHook(() => usePlanningBoard('2026-08-01', '2026-08-31'), { wrapper })
    const first = result.current.shifts
    rerender()
    expect(result.current.shifts).toBe(first)
  })
})
