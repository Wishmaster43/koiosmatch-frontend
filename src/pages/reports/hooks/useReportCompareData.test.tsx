/**
 * useReportCompareData — wiring test. The hook takes period/reportKey/filters/data/compare,
 * builds compareBaseParams, gets the compareSlug, and calls useReportCompare with the
 * built params. It extracts and types totalCompare from the response.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useReportCompareData } from './useReportCompareData'
import type { ReactNode } from 'react'

// Mock the low-level useReportCompare hook.
const mockUseReportCompare = vi.fn()
vi.mock('../useReportCompare', () => ({ useReportCompare: (...args: unknown[]) => mockUseReportCompare(...args) }))

// Mock the slug getter.
vi.mock('../reportCompareSupport', () => ({ getCompareSlug: (key: string) => `${key}-slug` }))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useReportCompareData — compare wrapper', () => {
  beforeEach(() => {
    mockUseReportCompare.mockReset()
  })

  it('builds compareBaseParams from period/reportKey/filters and calls useReportCompare', () => {
    mockUseReportCompare.mockReturnValue({ data: null, loading: false, error: false })

    renderHook(
      () => useReportCompareData(
        'month',
        'tasks',
        { status: ['open'], ownerId: [], locationId: [], customerId: [] },
        { from: '2026-08-01', to: '2026-08-31' },
        { kind: 'previous_period' },
      ),
      { wrapper },
    )

    expect(mockUseReportCompare).toHaveBeenCalledWith(
      'tasks-slug',
      '2026-08-01',
      '2026-08-31',
      { kind: 'previous_period' },
      expect.objectContaining({ period: 'month', status: ['open'] }),
    )
  })

  it('extracts totalCompare when compare.kind is not off', () => {
    const mockTotal = { current: 100, previous: 80, delta: 20, delta_pct: 25 }
    mockUseReportCompare.mockReturnValue({
      data: { total: mockTotal },
      loading: false,
      error: false,
    })

    const { result } = renderHook(
      () => useReportCompareData(
        'month',
        'candidates',
        { status: [], ownerId: [], locationId: [], customerId: [] },
        { from: '2026-08-01', to: '2026-08-31' },
        { kind: 'previous_year' },
      ),
      { wrapper },
    )

    expect(result.current.totalCompare).toEqual(mockTotal)
  })

  it('returns undefined totalCompare when compare.kind is off', () => {
    mockUseReportCompare.mockReturnValue({
      data: { total: { current: 100, previous: 80, delta: 20, delta_pct: 25 } },
      loading: false,
      error: false,
    })

    const { result } = renderHook(
      () => useReportCompareData(
        'month',
        'tasks',
        { status: [], ownerId: [], locationId: [], customerId: [] },
        { from: '2026-08-01', to: '2026-08-31' },
        { kind: 'off' },
      ),
      { wrapper },
    )

    expect(result.current.totalCompare).toBeUndefined()
  })

  it('passes loading/error through from the low-level hook', () => {
    mockUseReportCompare.mockReturnValue({
      data: null,
      loading: true,
      error: false,
    })

    const { result } = renderHook(
      () => useReportCompareData(
        'month',
        'tasks',
        { status: [], ownerId: [], locationId: [], customerId: [] },
        null,
        { kind: 'off' },
      ),
      { wrapper },
    )

    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBe(false)
  })

  it('handles undefined filters gracefully', () => {
    mockUseReportCompare.mockReturnValue({ data: null, loading: false, error: false })

    renderHook(
      () => useReportCompareData(
        'month',
        'applications',
        undefined,
        { from: '2026-08-01', to: '2026-08-31' },
        { kind: 'off' },
      ),
      { wrapper },
    )

    expect(mockUseReportCompare).toHaveBeenCalledWith(
      'applications-slug',
      '2026-08-01',
      '2026-08-31',
      { kind: 'off' },
      expect.objectContaining({ period: 'month' }),
    )
  })
})
