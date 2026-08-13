/**
 * useReportDrill — data layer for ReportDrillDrawer (REPORTS-DRILL-1). Pins the
 * request shape (route + params) per report, the `{ data, meta: { total } }` envelope
 * unwrap, the truncation total, the calm 403 degrade, and the null-advice-with-rows
 * combination — regression coverage for the 2026-08-13 drill-gate open.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

import api from '@/lib/api'
import { useReportDrill } from './useReportDrill'
import type { DrillSpec } from './ReportDrillDrawer'

const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

// One fresh QueryClient per render; retry:false so a rejected fetch (the 403 case)
// settles immediately instead of running React Query's backoff.
function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('useReportDrill — request shape per report', () => {
  it('flow: passes phase + period + view (mirrors the funnel bar it explains)', async () => {
    mockedGet.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
    const drill: DrillSpec = {
      title: 'x', value: 1,
      rowsEndpoint: '/reports/flow/drill',
      rowsParams: { phase: 'applied', period: 'month', view: 'reached' },
    }
    renderHook(() => useReportDrill(drill), { wrapper: makeWrapper() })
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(mockedGet).toHaveBeenCalledWith('/reports/flow/drill', expect.objectContaining({
      params: { phase: 'applied', period: 'month', view: 'reached' },
    }))
  })

  it('matches: passes origin + period', async () => {
    mockedGet.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
    const drill: DrillSpec = {
      title: 'x', value: 1,
      rowsEndpoint: '/reports/matches/drill',
      rowsParams: { origin: 'funnel', period: 'month' },
    }
    renderHook(() => useReportDrill(drill), { wrapper: makeWrapper() })
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(mockedGet).toHaveBeenCalledWith('/reports/matches/drill', expect.objectContaining({
      params: { origin: 'funnel', period: 'month' },
    }))
  })

  it('recruiters: passes recruiter (owner uuid) + period', async () => {
    mockedGet.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
    const drill: DrillSpec = {
      title: 'x', value: 1,
      rowsEndpoint: '/reports/recruiters/drill',
      rowsParams: { recruiter: 'uuid-1', period: 'month' },
    }
    renderHook(() => useReportDrill(drill), { wrapper: makeWrapper() })
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(mockedGet).toHaveBeenCalledWith('/reports/recruiters/drill', expect.objectContaining({
      params: { recruiter: 'uuid-1', period: 'month' },
    }))
  })

  it('vacancies: passes status XOR vacancy + period', async () => {
    mockedGet.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
    const drill: DrillSpec = {
      title: 'x', value: 1,
      rowsEndpoint: '/reports/vacancies/drill',
      rowsParams: { status: 'open', period: 'month' },
    }
    renderHook(() => useReportDrill(drill), { wrapper: makeWrapper() })
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(mockedGet).toHaveBeenCalledWith('/reports/vacancies/drill', expect.objectContaining({
      params: { status: 'open', period: 'month' },
    }))
  })
})

describe('useReportDrill — envelope + truncation', () => {
  it('unwraps { data, meta: { total } } into rows + rowsTotal', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: '1' }, { id: '2' }], meta: { total: 137 } } })
    const drill: DrillSpec = { title: 'x', value: 1, rowsEndpoint: '/reports/flow/drill', rowsParams: { period: 'month' } }
    const { result } = renderHook(() => useReportDrill(drill), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    expect(result.current.rowsTotal).toBe(137)
  })
})

describe('useReportDrill — 403 on a segment without data permission', () => {
  it('flags rowsForbidden without throwing, while advice still loads', async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === '/reports/flow/drill') {
        const err = new Error('Forbidden') as Error & { response: { status: number } }
        err.response = { status: 403 }
        throw err
      }
      return { data: { advice: 'Keep going.' } }
    })
    const drill: DrillSpec = {
      title: 'x', value: 1,
      rowsEndpoint: '/reports/flow/drill', rowsParams: { period: 'month' },
      adviceEndpoint: '/reports/flow/advice', adviceParams: { period: 'month' },
    }
    const { result } = renderHook(() => useReportDrill(drill), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.rowsForbidden).toBe(true))
    await waitFor(() => expect(result.current.advice).toBe('Keep going.'))
    expect(result.current.rows).toEqual([])
  })
})

describe('useReportDrill — advice degrades to null while rows are present', () => {
  it('rows render normally alongside a null advice (degraded koios_ai)', async () => {
    mockedGet.mockImplementation(async (url: string) => {
      if (url === '/reports/matches/drill') return { data: { data: [{ id: 'm1', name: 'Match 1' }], meta: { total: 1 } } }
      return { data: { advice: null } }
    })
    const drill: DrillSpec = {
      title: 'x', value: 1,
      rowsEndpoint: '/reports/matches/drill', rowsParams: { period: 'month' },
      adviceEndpoint: '/reports/matches/advice', adviceParams: { period: 'month' },
    }
    const { result } = renderHook(() => useReportDrill(drill), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    expect(result.current.advice).toBeNull()
    expect(result.current.rowsForbidden).toBe(false)
  })
})
