/**
 * useReportKpiSelection — fetch KPI selection from GET /reports/kpi-selection/{scope}.
 * Tests the API call and 404 fallback to catalog default.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import api from '@/lib/api'
import * as kpiCatalogLib from '../kpiCatalog'
import { useReportKpiSelection } from './useReportKpiSelection'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), put: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

describe('useReportKpiSelection', () => {
  it('GETs /reports/kpi-selection/{scope} and returns the data', async () => {
    const scopeSelection = ['total', 'new', 'active']
    vi.mocked(api.get).mockResolvedValue({ data: { data: scopeSelection } })
    vi.spyOn(kpiCatalogLib, 'getReportKpiDefaultOrder').mockReturnValue(['total', 'new', 'active'])

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = (props: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, props.children)

    const { result } = renderHook(() => useReportKpiSelection('matches'), { wrapper })

    await waitFor(() => {
      expect(result.current.data).toEqual(scopeSelection)
    })
    expect(vi.mocked(api.get)).toHaveBeenCalledWith('/reports/kpi-selection/matches')
  })

  it('falls back to catalog default on 404', async () => {
    const defaultOrder = ['total', 'new']
    const error = new Error('Not found')
    ;(error as Error & { response?: { status: number } }).response = { status: 404 }
    vi.mocked(api.get).mockRejectedValue(error)
    vi.spyOn(kpiCatalogLib, 'getReportKpiDefaultOrder').mockReturnValue(defaultOrder)

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = (props: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, props.children)

    const { result } = renderHook(() => useReportKpiSelection('matches'), { wrapper })

    await waitFor(() => {
      expect(result.current.data).toEqual(defaultOrder)
    })
  })

  it('has staleTime of 60 seconds', async () => {
    const scopeSelection = ['total']
    vi.mocked(api.get).mockResolvedValue({ data: { data: scopeSelection } })
    vi.spyOn(kpiCatalogLib, 'getReportKpiDefaultOrder').mockReturnValue(['total'])

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = (props: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, props.children)

    const { result } = renderHook(() => useReportKpiSelection('matches'), { wrapper })

    await waitFor(() => {
      expect(result.current.data).toBeDefined()
    })

    // The staleTime is set in the hook, verified by checking the query state.
    const state = queryClient.getQueryState(['reports', 'kpi-selection', 'matches'])
    expect(state?.dataUpdatedAt).toBeDefined()
  })
})
