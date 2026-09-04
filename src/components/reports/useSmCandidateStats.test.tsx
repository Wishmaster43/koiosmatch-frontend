/**
 * useSmCandidateStats — pins the exact request (route + params), never only that
 * a callback fired (§13). Also proves the returned aggregate values pass through
 * untouched, so a chart/KPI reading `stats.by_status` gets real server counts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSmCandidateStats } from './useSmCandidateStats'
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

const SAMPLE_RESPONSE = {
  total: 42,
  by_status: [{ label: 'Actief', total: 30 }, { label: 'Onbekend', total: 12 }],
  by_position: [{ label: 'Verpleegkundige', total: 10 }],
  by_city: [{ label: 'Amsterdam', total: 5 }],
  by_type_of_employee: [{ label: 'ZZP', total: 8 }],
  login_recency: { last_30_days: 20, last_90_days: 10, older: 5, never: 7 },
  registrations_per_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 })),
  departures_per_month: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 })),
}

describe('useSmCandidateStats', () => {
  it('GETs /sm_candidates/stats with no params when called unfiltered', async () => {
    mockedGet.mockResolvedValue({ data: SAMPLE_RESPONSE })
    const { result } = renderHook(() => useSmCandidateStats(), { wrapper })

    await waitFor(() => expect(result.current.stats).not.toBeNull())

    expect(mockedGet).toHaveBeenCalledWith('/sm_candidates/stats', { params: {}, signal: expect.anything() })
  })

  it('passes status/top_cities/year through as query params, dropping unset filters', async () => {
    mockedGet.mockResolvedValue({ data: SAMPLE_RESPONSE })
    renderHook(() => useSmCandidateStats({ status: 'actief', top_cities: 5, year: 2026 }), { wrapper })

    await waitFor(() => expect(mockedGet).toHaveBeenCalled())

    expect(mockedGet).toHaveBeenCalledWith(
      '/sm_candidates/stats',
      { params: { status: 'actief', top_cities: 5, year: 2026 }, signal: expect.anything() },
    )
  })

  it('returns the server aggregates untouched (real counts, not derived from rows)', async () => {
    mockedGet.mockResolvedValue({ data: SAMPLE_RESPONSE })
    const { result } = renderHook(() => useSmCandidateStats(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.stats).toEqual(SAMPLE_RESPONSE)
    expect(result.current.error).toBe(false)
  })

  it('reports error when the request fails, without throwing', async () => {
    mockedGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useSmCandidateStats(), { wrapper })

    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.stats).toBeNull()
  })
})
