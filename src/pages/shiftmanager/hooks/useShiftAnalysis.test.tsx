/**
 * useShiftAnalysis — pins the request and the English alarm ids derived per candidate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const get = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...a: unknown[]) => get(...a) },
  isServiceUnavailable: () => false,
}))

import { useShiftAnalysis, METRIC_KEYS } from './useShiftAnalysis'

// Month key helper relative to now so the fixtures stay valid whenever the test runs.
function monthKey(offset: number) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const recent = new Date(Date.now() - 5 * 86400000).toISOString()

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
)

beforeEach(() => {
  get.mockReset()
  get.mockResolvedValue({ data: { data: [
    { candidate_id: 'a', name: 'A', registration_date: recent, months: { [monthKey(-1)]: { werkelijk_hours: 20 } } },
    { candidate_id: 'b', name: 'B', registration_date: recent, months: { [monthKey(-1)]: { werkelijk_hours: 20 }, [monthKey(0)]: { prognose_hours: 4 } } },
    { candidate_id: 'c', name: 'C', registration_date: recent, months: { [monthKey(1)]: { prognose_hours: 12, prognose_shifts: 2 } } },
  ] } })
})

describe('useShiftAnalysis', () => {
  it('requests the per-candidate feed and derives dropping_out, declining and rising', async () => {
    const { result } = renderHook(() => useShiftAnalysis(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(get).toHaveBeenCalledWith('/sm_reports/shifts-per-candidate', expect.objectContaining({ signal: expect.anything() }))
    const alarms = Object.fromEntries(result.current.rows.map(r => [r.id, r.alarm]))
    expect(alarms).toEqual({ a: 'dropping_out', b: 'declining', c: 'rising' })
    // The matrix reads the NORMALISED English cell keys (ShiftMatrixTable: r.months[c]?.[metric]),
    // and the planned count comes from the Dutch wire key prognose_shifts through the same seam.
    expect(result.current.matrixRows.find(r => r.id === 'a')?.months[monthKey(-1)]).toEqual({ actual_hours: 20 })
    expect(result.current.plannedPerMonth.find(p => p.month === monthKey(1))?.count).toBe(1)
  })

  // English cell keys must derive the same rows and planned counts as the Dutch wire keys.
  it('reads English cell keys and counts planned shifts per month', async () => {
    get.mockResolvedValue({ data: { data: [
      { candidate_id: 'a', name: 'A', registration_date: recent, months: { [monthKey(-1)]: { actual_hours: 20 } } },
      { candidate_id: 'b', name: 'B', registration_date: recent, months: { [monthKey(-1)]: { actual_hours: 20 }, [monthKey(0)]: { forecast_hours: 4 } } },
      { candidate_id: 'c', name: 'C', registration_date: recent, months: { [monthKey(1)]: { forecast_hours: 12, forecast_shifts: 2 } } },
    ] } })
    const { result } = renderHook(() => useShiftAnalysis(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const alarms = Object.fromEntries(result.current.rows.map(r => [r.id, r.alarm]))
    expect(alarms).toEqual({ a: 'dropping_out', b: 'declining', c: 'rising' })
    expect(result.current.plannedPerMonth.find(p => p.month === monthKey(1))?.count).toBe(1)
  })

  // The public metric list is the English wire-seam list.
  it('exposes the English metric keys', () => {
    expect(METRIC_KEYS).toEqual(['forecast_hours', 'forecast_shifts', 'actual_hours', 'actual_shifts'])
  })
})
