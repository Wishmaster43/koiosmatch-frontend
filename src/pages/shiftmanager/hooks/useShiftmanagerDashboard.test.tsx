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

// Every endpoint the hook can call, so an un-awaited query never hangs a test.
function mockAllEndpoints() {
  mockedGet.mockImplementation((url: string) => {
    if (url === '/sm_candidates')        return Promise.resolve({ data: { data: [] } })
    if (url === '/sm_reports/dashboard') return Promise.resolve({ data: {} })
    if (url === '/workflow-runs')        return Promise.resolve({ data: { data: [] } })
    if (url === '/whatsapp/messages')    return Promise.resolve({ data: { data: [] } })
    return Promise.resolve({ data: {} })
  })
}

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
