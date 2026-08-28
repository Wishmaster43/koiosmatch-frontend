/**
 * useCandidatesReport — the data layer's own request-shape test (§13: assert
 * the REQUEST, not just that a callback fired). RAPPORTEN-CONSOLIDATIE-1 added
 * the optional `phaseFilter` param the Instroom page's Kandidaten/Leads switch
 * uses — this proves it reaches `GET /reports/candidates` as a real `phase`
 * query param, layered on top of the existing panel filters, and that it is
 * OMITTED entirely (never `phase: null`) when the switch is on Kandidaten.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCandidatesReport } from './useCandidatesReport'

const getSpy = vi.fn().mockResolvedValue({ data: { total: 0 } })
vi.mock('@/lib/api', () => ({ default: { get: (...args: unknown[]) => getSpy(...args) } }))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useCandidatesReport — request shape', () => {
  afterEach(() => getSpy.mockClear())

  it('omits `phase` entirely on the default (Kandidaten) call — never sends phase: null', async () => {
    const { result } = renderHook(() => useCandidatesReport('month'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates', expect.objectContaining({ params: { period: 'month' } }))
    const call = getSpy.mock.calls[0][1] as { params: Record<string, unknown> }
    expect(call.params).not.toHaveProperty('phase')
  })

  it('sends the Leads switch\'s `phase` filter as a real server-side param, layered on top of the panel filters', async () => {
    const filters = { status: ['available'], ownerId: ['u1'], locationId: [], customerId: [] }
    const { result } = renderHook(() => useCandidatesReport('month', filters, 'lead'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates', expect.objectContaining({
      params: { period: 'month', status: ['available'], owner_id: ['u1'], phase: ['lead'] },
    }))
  })

  it('caches Kandidaten and Leads separately — the phase filter is part of the query key', async () => {
    const { result, rerender } = renderHook(
      ({ phase }: { phase: string | null }) => useCandidatesReport('month', undefined, phase),
      { wrapper, initialProps: { phase: null as string | null } },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    rerender({ phase: 'lead' })
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2))
    expect(getSpy.mock.calls[1][1]).toEqual(expect.objectContaining({ params: { period: 'month', phase: ['lead'] } }))
  })
})
