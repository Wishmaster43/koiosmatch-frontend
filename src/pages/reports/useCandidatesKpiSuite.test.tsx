/**
 * useCandidatesKpiSuite — request shape (GET /reports/candidates/kpis with the
 * period params), keyed values, and an honest error flag instead of silent dashes.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCandidatesKpiSuite } from './useCandidatesKpiSuite'

const getSpy = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...args: unknown[]) => getSpy(...args) } }))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
const NO_FILTERS = { status: [], ownerId: [], locationId: [], customerId: [] }

describe('useCandidatesKpiSuite', () => {
  afterEach(() => getSpy.mockReset())

  it('GETs the suite and keys the counts by server key', async () => {
    getSpy.mockResolvedValue({ data: { data: [{ key: 'total', count: 7 }, { key: 'no_cv', count: null }] } })
    const { result } = renderHook(() => useCandidatesKpiSuite('month', NO_FILTERS, true), { wrapper })
    await waitFor(() => expect(result.current.values.get('total')).toBe(7))
    expect(getSpy.mock.calls[0][0]).toBe('/reports/candidates/kpis')
    expect(getSpy.mock.calls[0][1].params).toMatchObject({ period: 'month' })
    expect(result.current.values.get('no_cv')).toBeNull()
    expect(result.current.error).toBe(false)
  })

  it('reports a failed fetch as error (no values)', async () => {
    getSpy.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useCandidatesKpiSuite('month', NO_FILTERS, true), { wrapper })
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.values.size).toBe(0)
  })

  it('fires no request and reports no error while disabled', () => {
    const { result } = renderHook(() => useCandidatesKpiSuite('month', NO_FILTERS, false), { wrapper })
    expect(getSpy).not.toHaveBeenCalled()
    expect(result.current.error).toBe(false)
  })
})
