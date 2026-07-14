/**
 * useShiftsChartData — regression test for the SM-2YR redesign: selecting 2 years
 * must never again explode into years × series bars (Danny 2026-07-06: "10
 * series-kolommen" for just 2 years, unreadable). With a single metric chosen, the
 * bar count equals the number of selected years, and only the older year is muted
 * via color-mix — the most recent year keeps the plain series colour.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useShiftsChartData } from './useShiftsChartData'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

// Fresh QueryClient per render — no cross-test cache bleed, no retries slowing failures.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const baseArgs = {
  selectedMonths: Array.from({ length: 12 }, (_, i) => String(i + 1)),
  period: 'month',
  visible: ['totaal', 'niet_ingevuld', 'geen_kandidaat', 'prognose', 'werkelijk'],
  selectedJobTypes: [], selectedCustomers: [], selectedLocations: [],
  fixedCustomers: [], fixedLocationIds: [], fixedDepartmentId: null, fixedCandidateId: null,
  seriesLabel: (key: string) => key,
}

describe('useShiftsChartData — SM-2YR bar count', () => {
  it('single-year view is untouched: one bar per visible series', async () => {
    mockedGet.mockImplementation((url: string) => Promise.resolve({
      data: url.includes('filter-options') ? { job_types: [], locations: [] } : { data: [] },
    }))
    const { result } = renderHook(
      () => useShiftsChartData({ ...baseArgs, selectedYears: [2026], multiYearMetric: null }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hoursBars).toHaveLength(5)
  })

  it('caps multi-year bars at one per selected year, not years × series', async () => {
    mockedGet.mockImplementation((url: string) => Promise.resolve({
      data: url.includes('filter-options') ? { job_types: [], locations: [] } : { data: [] },
    }))
    const { result } = renderHook(
      () => useShiftsChartData({ ...baseArgs, selectedYears: [2025, 2026], multiYearMetric: 'totaal' }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    // Was 2 years × 5 series = 10 before the redesign — now exactly 2 (one per year).
    expect(result.current.hoursBars).toHaveLength(2)
    // hoursBars carry the `_uren` suffix on seriesKey (see useShiftsChartData).
    expect(result.current.hoursBars.every((b) => b.seriesKey === 'totaal_uren')).toBe(true)
  })

  it('keeps the newest year at full colour and mutes the older year via color-mix', async () => {
    mockedGet.mockImplementation((url: string) => Promise.resolve({
      data: url.includes('filter-options') ? { job_types: [], locations: [] } : { data: [] },
    }))
    const { result } = renderHook(
      () => useShiftsChartData({ ...baseArgs, selectedYears: [2025, 2026], multiYearMetric: 'totaal' }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    const bar2026 = result.current.hoursBars.find((b) => b.year === 2026)!
    const bar2025 = result.current.hoursBars.find((b) => b.year === 2025)!
    expect(bar2026.fill).toBe(bar2026.color)
    expect(bar2025.fill).toContain('color-mix')
    expect(bar2026.name).toContain('2026')
    expect(bar2025.name).toContain('2025')
  })
})
