/**
 * useShiftmanagerDashboard — K-3: the "recent workflow runs" tile
 * (GET /workflow-runs) is a workflow-EXECUTION call and must route through the
 * configurable engine base URL (resolveWorkflowBaseURL), same as every other
 * run/cancel/logs call. Pins the route, the `per_page` param, and the resolved
 * baseURL together — a callback firing alone proves nothing about the request (§13).
 *
 * Also covers the ENT2-06/WFB-09 regression: the recent-runs mapper used to read
 * field names (name/status='ok'/processed_count/error) the backend never emits,
 * so every run rendered red with an empty title. Fixed to read the real
 * RunPresenter contract (workflow_name/candidates_count/error_message/started_at)
 * and to return a tri-state ok (true completed / false failed-cancelled / null
 * in-flight) instead of collapsing "running" into "completed successfully". The
 * actual RENDER of that tri-state (which colour paints) is asserted separately
 * in ShiftmanagerDashboard.test.tsx, not here — this file only proves the mapper.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useShiftmanagerDashboard } from './useShiftmanagerDashboard'
import api from '@/lib/api'

// Real unwrapList (pure) + a mocked api.get, mirroring the file's own siblings.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { default: { get: vi.fn() }, unwrapList: actual.unwrapList }
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

describe('useShiftmanagerDashboard · recent-runs mapper reads the real RunPresenter contract', () => {
  it('maps a completed run to its real name/count/time and ok=true', async () => {
    mockedGet.mockImplementation((url: string) => Promise.resolve({
      data: url === '/workflow-runs'
        ? { data: [{ id: 'r1', workflow_name: 'Nachtelijke sync', status: 'success', candidates_count: 460, error_message: null, started_at: '2026-09-01T02:00:00Z' }] }
        : { data: [] },
    }))
    const { result } = renderHook(() => useShiftmanagerDashboard(10, true), { wrapper })
    await waitFor(() => expect(result.current.runs).toHaveLength(1))
    expect(result.current.runs[0]).toMatchObject({ name: 'Nachtelijke sync', ok: true, n: 460, err: undefined })
  })

  it('marks a failed run as not-ok (false) and keeps its error message', async () => {
    mockedGet.mockImplementation((url: string) => Promise.resolve({
      data: url === '/workflow-runs'
        ? { data: [{ id: 'r2', workflow_name: 'Failing sync', status: 'failed', candidates_count: 0, error_message: 'Timeout', started_at: '2026-09-01T02:00:00Z' }] }
        : { data: [] },
    }))
    const { result } = renderHook(() => useShiftmanagerDashboard(10, true), { wrapper })
    await waitFor(() => expect(result.current.runs).toHaveLength(1))
    expect(result.current.runs[0]).toMatchObject({ ok: false, err: 'Timeout' })
  })

  it('marks an in-flight "running" run as the neutral ok=null state, distinct from a completed success', async () => {
    mockedGet.mockImplementation((url: string) => Promise.resolve({
      data: url === '/workflow-runs'
        ? { data: [{ id: 'r3', workflow_name: 'Long sync', status: 'running', candidates_count: 12, error_message: null, started_at: '2026-09-01T02:00:00Z' }] }
        : { data: [] },
    }))
    const { result } = renderHook(() => useShiftmanagerDashboard(10, true), { wrapper })
    await waitFor(() => expect(result.current.runs).toHaveLength(1))
    // Distinct from ok:true — SCHERMWAARHEID-1: a still-running sync must not be
    // able to paint as a completed success. The RENDER of this null state (which
    // colour/icon/copy it produces) is asserted in ShiftmanagerDashboard.test.tsx.
    expect(result.current.runs[0]).toMatchObject({ ok: null, name: 'Long sync' })
  })

  it('marks an in-flight "waiting" run as the same neutral ok=null state', async () => {
    mockedGet.mockImplementation((url: string) => Promise.resolve({
      data: url === '/workflow-runs'
        ? { data: [{ id: 'r4', workflow_name: 'Queued sync', status: 'waiting', candidates_count: 0, error_message: null, started_at: '2026-09-01T02:00:00Z' }] }
        : { data: [] },
    }))
    const { result } = renderHook(() => useShiftmanagerDashboard(10, true), { wrapper })
    await waitFor(() => expect(result.current.runs).toHaveLength(1))
    expect(result.current.runs[0]).toMatchObject({ ok: null })
  })
})
