/**
 * useShiftmanagerDashboard — K-3: the "recent workflow runs" tile
 * (GET /workflow-runs) is a workflow-EXECUTION call and must route through the
 * configurable engine base URL (resolveWorkflowBaseURL), same as every other
 * run/cancel/logs call. Pins the route, the `per_page` param, and the resolved
 * baseURL together — a callback firing alone proves nothing about the request (§13).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useShiftmanagerDashboard } from './useShiftmanagerDashboard'
import api from '@/lib/api'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

// Fresh QueryClient per render — no cross-test cache bleed, no retries slowing failures.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

// Sample stats response — total 900 exceeds the 500-row server cap, so a test
// reading this instead of `candidates.length` proves the stats-driven fields
// are not silently undercounted by the row page.
const SAMPLE_STATS = {
  total: 900,
  by_status: [{ label: 'actief', total: 900 }],
  by_position: [], by_city: [], by_type_of_employee: [],
  login_recency: { last_30_days: 0, last_90_days: 0, older: 0, never: 0 },
  registrations_per_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: i === new Date().getMonth() ? 40 : 10 })),
  departures_per_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 })),
}

// Every endpoint the hook can call, so an un-awaited query never hangs a test.
function mockAllEndpoints() {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/sm_candidates')         return Promise.resolve({ data: { data: [] } })
    if (url === '/sm_candidates/stats')   return Promise.resolve({ data: SAMPLE_STATS })
    if (url === '/sm_reports/dashboard')  return Promise.resolve({ data: {} })
    if (url === '/workflow-runs')         return Promise.resolve({ data: { data: [] } })
    if (url === '/whatsapp/messages')     return Promise.resolve({ data: { data: [] } })
    return Promise.resolve({ data: {} })
  })
}

describe('useShiftmanagerDashboard · candidates fetch (PERF-1)', () => {
  it('GETs /sm_candidates with the exact perPage it is given (honours the configured setting)', async () => {
    mockAllEndpoints()
    renderHook(() => useShiftmanagerDashboard(500, false), { wrapper })

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/sm_candidates', expect.anything()))
    expect(mockedGet).toHaveBeenCalledWith(
      '/sm_candidates',
      { params: { per_page: 500 }, signal: expect.anything() },
    )
  })
})

describe('useShiftmanagerDashboard · candidate stats (SM-STATS-2)', () => {
  it('GETs /sm_candidates/stats with the current year, and returns the server aggregate untouched', async () => {
    mockAllEndpoints()
    const { result } = renderHook(() => useShiftmanagerDashboard(500, false), { wrapper })

    await waitFor(() => expect(result.current.candidateStats).not.toBeNull())

    expect(mockedGet).toHaveBeenCalledWith(
      '/sm_candidates/stats',
      { params: { year: new Date().getFullYear() }, signal: expect.anything() },
    )
    expect(result.current.candidateStats).toEqual(SAMPLE_STATS)
    expect(result.current.candidateStatsError).toBe(false)
  })
})

describe('useShiftmanagerDashboard · recent runs tile (K-3 workflow-execution base URL)', () => {
  it('GETs /workflow-runs with per_page:5 and the resolved workflow base URL, only when hasAI', async () => {
    mockAllEndpoints()
    const { result } = renderHook(() => useShiftmanagerDashboard(10, true), { wrapper })

    await waitFor(() => expect(result.current.runs).toEqual([]))

    expect(mockedGet).toHaveBeenCalledWith(
      '/workflow-runs',
      { params: { per_page: 5 }, signal: expect.anything(), baseURL: expect.any(String) },
    )
  })

  it('never requests /workflow-runs when the tenant has no AI/Workflow package', async () => {
    mockAllEndpoints()
    renderHook(() => useShiftmanagerDashboard(10, false), { wrapper })

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/sm_candidates', expect.anything()))
    expect(mockedGet).not.toHaveBeenCalledWith('/workflow-runs', expect.anything())
  })
})
