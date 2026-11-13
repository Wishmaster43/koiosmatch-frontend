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

import { useShiftAnalysis } from './useShiftAnalysis'

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
    { candidate_id: 'c', name: 'C', registration_date: recent, months: { [monthKey(1)]: { prognose_hours: 12 } } },
  ] } })
})

describe('useShiftAnalysis', () => {
  it('requests the per-candidate feed and derives dropping_out, declining and rising', async () => {
    const { result } = renderHook(() => useShiftAnalysis(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(get).toHaveBeenCalledWith('/sm_reports/shifts-per-candidate', expect.objectContaining({ signal: expect.anything() }))
    const alarms = Object.fromEntries(result.current.rows.map(r => [r.id, r.alarm]))
    expect(alarms).toEqual({ a: 'dropping_out', b: 'declining', c: 'rising' })
  })
})
