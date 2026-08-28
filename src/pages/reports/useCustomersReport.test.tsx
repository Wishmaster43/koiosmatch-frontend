/**
 * useCustomersReport — the data layer's own request-shape test (§13: assert
 * the REQUEST, not just that a callback fired). RAPPORTEN-CONSOLIDATIE-1 added
 * the optional `phaseFilter` param the Klanten page's Klanten/Prospects switch
 * uses — this proves it reaches `GET /reports/customers` as a real `phase`
 * query param, layered on top of the existing panel filters, and that it is
 * OMITTED entirely (never `phase: null`) when the switch is on Klanten.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCustomersReport } from './useCustomersReport'

const getSpy = vi.fn().mockResolvedValue({ data: { total: 0 } })
vi.mock('@/lib/api', () => ({ default: { get: (...args: unknown[]) => getSpy(...args) } }))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useCustomersReport — request shape', () => {
  afterEach(() => getSpy.mockClear())

  it('omits `phase` entirely on the default (Klanten) call — never sends phase: null', async () => {
    const { result } = renderHook(() => useCustomersReport('month'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers', expect.objectContaining({ params: { period: 'month' } }))
    const call = getSpy.mock.calls[0][1] as { params: Record<string, unknown> }
    expect(call.params).not.toHaveProperty('phase')
  })

  it('sends the Prospects switch\'s `phase` filter as a real server-side param, layered on top of the panel filters', async () => {
    const filters = { status: [], ownerId: ['u1'], locationId: [7], customerId: [] }
    const { result } = renderHook(() => useCustomersReport('month', filters, 'prospect'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers', expect.objectContaining({
      params: { period: 'month', owner_id: ['u1'], location_id: [7], phase: ['prospect'] },
    }))
  })

  it('caches Klanten and Prospects separately — the phase filter is part of the query key', async () => {
    const { result, rerender } = renderHook(
      ({ phase }: { phase: string | null }) => useCustomersReport('month', undefined, phase),
      { wrapper, initialProps: { phase: null as string | null } },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    rerender({ phase: 'prospect' })
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2))
    expect(getSpy.mock.calls[1][1]).toEqual(expect.objectContaining({ params: { period: 'month', phase: ['prospect'] } }))
  })
})
