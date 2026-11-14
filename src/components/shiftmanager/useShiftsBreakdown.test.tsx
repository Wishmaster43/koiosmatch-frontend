// REQUEST-ASSERT-1: the breakdown hook sends the English metric ids.
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const get = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }))

import { useShiftsBreakdown } from './useShiftsBreakdown'

describe('useShiftsBreakdown', () => {
  it('requests the English metric ids', async () => {
    get.mockResolvedValue({ data: { data: [] } })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    renderHook(() => useShiftsBreakdown('year=2026'), { wrapper })
    await waitFor(() => expect(get).toHaveBeenCalledTimes(4))
    // Exact per-call URLs: the English metric ids travel as-is, each paired with its group_by (+ split).
    const urls = get.mock.calls.map((c) => String(c[0])).sort()
    expect(urls).toEqual([
      '/sm_reports/shifts-breakdown?year=2026&metric=forecast&group_by=customer',
      '/sm_reports/shifts-breakdown?year=2026&metric=no_candidate&group_by=customer&split=month',
      '/sm_reports/shifts-breakdown?year=2026&metric=no_candidate&group_by=job_type',
      '/sm_reports/shifts-breakdown?year=2026&metric=total&group_by=customer',
    ])
    const keys = client.getQueryCache().getAll().map((q) => q.queryKey.join('|'))
    expect(keys.some((k) => k.includes('|no_candidate|'))).toBe(true)
    expect(keys.some((k) => k.includes('|total|'))).toBe(true)
    expect(keys.some((k) => k.includes('|forecast|'))).toBe(true)
  })
})
