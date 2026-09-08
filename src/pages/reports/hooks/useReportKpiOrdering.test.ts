/**
 * useReportKpiOrdering — resolve KPI order from the API with fallback.
 * Uses useReportKpiSelection to GET /reports/kpi-selection/{scope}.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import api from '@/lib/api'
import * as kpiCatalogLib from '../kpiCatalog'
import { useReportKpiOrdering } from './useReportKpiOrdering'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

describe('useReportKpiOrdering', () => {
  it('returns kpiOrder from API with loading state', async () => {
    const defaultOrder = ['total', 'new']
    vi.mocked(api.get).mockResolvedValue({ data: { data: defaultOrder } })

    vi.spyOn(kpiCatalogLib, 'getReportKpiCatalog').mockReturnValue([
      { key: 'total', labelKey: 'test.total' },
      { key: 'new', labelKey: 'test.new' },
    ] as unknown as ReturnType<typeof kpiCatalogLib.getReportKpiCatalog>)
    vi.spyOn(kpiCatalogLib, 'getReportKpiDefaultOrder').mockReturnValue(defaultOrder)

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = (props: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, props.children)

    const { result } = renderHook(() => useReportKpiOrdering('matches'), { wrapper })

    await waitFor(() => {
      expect(result.current.kpiOrder).toEqual(defaultOrder)
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('falls back to default order on 404', async () => {
    const defaultOrder = ['total', 'new']
    const error = new Error('Not found')
    ;(error as Error & { response?: { status: number } }).response = { status: 404 }
    vi.mocked(api.get).mockRejectedValue(error)

    vi.spyOn(kpiCatalogLib, 'getReportKpiCatalog').mockReturnValue([
      { key: 'total', labelKey: 'test.total' },
      { key: 'new', labelKey: 'test.new' },
    ] as unknown as ReturnType<typeof kpiCatalogLib.getReportKpiCatalog>)
    vi.spyOn(kpiCatalogLib, 'getReportKpiDefaultOrder').mockReturnValue(defaultOrder)

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = (props: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, props.children)

    const { result } = renderHook(() => useReportKpiOrdering('matches'), { wrapper })

    await waitFor(() => {
      expect(result.current.kpiOrder).toEqual(defaultOrder)
    })
  })
})
