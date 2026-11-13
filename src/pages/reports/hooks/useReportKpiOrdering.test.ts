/**
 * useReportKpiOrdering — resolve KPI order from the API with fallback.
 * Uses useReportKpiSelection to GET /reports/kpi-selection/{scope}.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import api from '@/lib/api'
import * as kpiCatalogLib from '../kpiCatalog'
import { useReportKpiOrdering, padKpiOrder } from './useReportKpiOrdering'

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

// REPORT-KPI-CATALOG-DRIFT-1: the backend selection for vacancies is its four-card default;
// that is a valid stored list (no banner) and the strip is topped up to nine.
describe('useReportKpiOrdering — backend default list', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('keeps the four-card backend default without a fallback notice and pads the strip to nine', async () => {
    const be = ['total', 'open', 'filled', 'fill_rate']
    vi.mocked(api.get).mockResolvedValue({ data: { data: be } })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = (props: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, props.children)
    const { result } = renderHook(() => useReportKpiOrdering('vacancies'), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(api.get).toHaveBeenCalledWith('/reports/kpi-selection/vacancies')
    expect(result.current.fellBack).toBe(false)
    expect(result.current.kpiOrder.slice(0, 4)).toEqual(be)
    expect(result.current.kpiOrder).toHaveLength(9)
  })

  it('falls back on a stored camelCase key the backend no longer knows', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: ['total', 'conversionPct'] } })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = (props: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, props.children)
    const { result } = renderHook(() => useReportKpiOrdering('applications'), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.fellBack).toBe(true)
  })

  it('a stored selection with the backend snake_case keys does not fall back', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: ['conversations_total', 'active_7d'] } })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = (props: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, props.children)
    const { result } = renderHook(() => useReportKpiOrdering('whatsapp'), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.fellBack).toBe(false)
  })
})

describe('padKpiOrder', () => {
  it('tops a short order up from the catalogue without repeating a key', () => {
    expect(padKpiOrder(['b'], ['a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
  })
})
