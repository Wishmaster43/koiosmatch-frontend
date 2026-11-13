// REQUEST-ASSERT-1: the breakdown hook sends today's Dutch wire metric ids for its English series ids.
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const get = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }))

import { useShiftsBreakdown } from './useShiftsBreakdown'

describe('useShiftsBreakdown', () => {
  it('requests the wire metric ids for the English series ids', async () => {
    get.mockResolvedValue({ data: { data: [] } })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    renderHook(() => useShiftsBreakdown('year=2026'), { wrapper })
    await waitFor(() => expect(get).toHaveBeenCalledTimes(4))
    // Exact per-call URLs: the wire still carries the Dutch metric ids today, each paired with its group_by (+ split).
    const urls = get.mock.calls.map((c) => String(c[0])).sort()
    expect(urls).toEqual([
      '/sm_reports/shifts-breakdown?year=2026&metric=geen_kandidaat&group_by=customer&split=month',
      '/sm_reports/shifts-breakdown?year=2026&metric=geen_kandidaat&group_by=job_type',
      '/sm_reports/shifts-breakdown?year=2026&metric=prognose&group_by=customer',
      '/sm_reports/shifts-breakdown?year=2026&metric=totaal&group_by=customer',
    ])
    const keys = client.getQueryCache().getAll().map((q) => q.queryKey.join('|'))
    expect(keys.some((k) => k.includes('|no_candidate|'))).toBe(true)
    expect(keys.some((k) => k.includes('|total|'))).toBe(true)
    expect(keys.some((k) => k.includes('|forecast|'))).toBe(true)
  })
})
