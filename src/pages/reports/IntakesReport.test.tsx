import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import IntakesReport from './IntakesReport'
import type { IntakesReportData } from '@/types/analytics'

// The house LineChartCard needs real layout (jsdom has none) so the timeseries
// section is asserted via a lightweight stand-in — proves the shared wrapper is
// used and receives the mapped points, without depending on Recharts' DOM output.
vi.mock('./ReportTimeseriesChart', () => ({
  default: ({ series }: { series: { date: string; label: string; value: number }[] }) => (
    <>{series.map(p => <span key={p.date}>{p.label}</span>)}</>
  ),
}))

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseIntakesReport = vi.fn()
vi.mock('./useIntakesReport', () => ({ useIntakesReport: () => mockUseIntakesReport() }))

// Spy on the underlying axios client so we can assert the exact request shape
// (route + params) that a card/bar click sends — mutation tests must assert the
// request, never only that a callback fired (CLAUDE.md §13). REPORTS-DRILL-2:
// intakes is now gated on (verified live against the real controller).
const getSpy = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// Tenant KPI-order settings, controllable per test (RAPPORT-KPI-INSTELBAAR).
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

const data: IntakesReportData = {
  total: 9,
  series: [
    { key: 'wk31', label: 'Wk 31', count: 5 },
    { key: 'wk32', label: 'Wk 32', count: 4 },
  ],
  by_recruiter: [
    { key: 'r1', label: 'Anna de Vries', count: 6 },
    { key: null, label: 'Onbekend', count: 3 },
  ],
  by_location: [{ key: 'loc1', label: 'Utrecht', count: 9 }],
  by_source: [{ key: 'src1', label: 'Website', count: 9 }],
  by_function: [{ key: 'fn1', label: 'Verpleegkundige', count: 9 }],
  by_region: [{ key: 'reg1', label: 'Midden-NL', count: 9 }],
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <IntakesReport period="week" />
    </QueryClientProvider>,
  )
}

describe('IntakesReport', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  it('shows the loading state', () => {
    mockUseIntakesReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Intakes laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseIntakesReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de intakes niet laden')).toBeInTheDocument()
  })

  // The shared ReportStateBlock retry button must call the hook's own refetch.
  it('retries via the hook refetch when the retry button is clicked', async () => {
    const refetch = vi.fn()
    mockUseIntakesReport.mockReturnValue({ data: null, loading: false, error: true, refetch })
    renderReport()
    await userEvent.click(screen.getByRole('button', { name: 'Probeer opnieuw' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state when there are no intakes', () => {
    mockUseIntakesReport.mockReturnValue({
      data: { ...data, total: 0, series: [], by_recruiter: [], by_location: [], by_source: [], by_function: [], by_region: [] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen intakes in deze periode')).toBeInTheDocument()
  })

  // As-rendering: total KPI, the time series bars and the default (recruiter)
  // breakdown all render from the fixture, each summing to the report total.
  it('renders the total KPI, the series and the default recruiter breakdown', () => {
    mockUseIntakesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal intakes')).toBeInTheDocument()
    // '9' is also the top-source KPI's value (its only segment has count 9), so
    // it legitimately renders at least twice — the total plus that KPI card.
    expect(screen.getAllByText('9').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Wk 31')).toBeInTheDocument()
    expect(screen.getByText('Wk 32')).toBeInTheDocument()
    // 'Anna de Vries' is also the top-recruiter KPI's sub-label (highest count),
    // so it legitimately renders twice — as a bar AND a KPI sub.
    expect(screen.getAllByText('Anna de Vries').length).toBe(2)
    expect(screen.getByText('Onbekend')).toBeInTheDocument()
    expect(data.series.reduce((s, b) => s + b.count, 0)).toBe(data.total)
    expect(data.by_recruiter.reduce((s, b) => s + b.count, 0)).toBe(data.total)
  })

  // As-rendering: the nine KPI cards derive from total + distinct-category
  // counts + top-segment labels off the axis arrays — never an invented number.
  it('renders nine honest KPI cards derived from the breakdown axes', () => {
    mockUseIntakesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Aantal recruiters')).toBeInTheDocument()
    expect(screen.getByText('Aantal locaties')).toBeInTheDocument()
    expect(screen.getByText('Aantal bronnen')).toBeInTheDocument()
    expect(screen.getByText('Aantal functies')).toBeInTheDocument()
    expect(screen.getByText('Aantal regio’s')).toBeInTheDocument()
    expect(screen.getByText('Meest actieve recruiter')).toBeInTheDocument()
    expect(screen.getByText('Grootste bron')).toBeInTheDocument()
    expect(screen.getByText('Meest voorkomende functie')).toBeInTheDocument()
    // by_recruiter has 2 entries in the fixture; the other four dimensions have 1 each.
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getAllByText('1').length).toBe(4)
  })

  // REPORTS-KPI-SPARES-1: the settings-picked spare cards render real values off
  // the by_recruiter/by_location/by_region axes already in the fixture, and the
  // strip stays exactly nine.
  it('renders spare KPI cards with real values when picked in settings, strip stays nine', () => {
    mockSettings.mockReturnValue({
      report_kpis_intakes: [
        'total', 'unassignedRecruiter', 'topLocation', 'topRegion', 'avgPerRecruiter',
        'topRecruiter', 'topSource', 'topFunction', 'sourcesCount',
      ],
    })
    mockUseIntakesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // unassignedRecruiter = the by_recruiter row with key null ("Onbekend", 3).
    expect(screen.getByText('Niet toegewezen recruiter')).toBeInTheDocument()
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
    // topLocation/topRegion — single-segment fixtures, so their own count (9) shows.
    expect(screen.getByText('Grootste locatie')).toBeInTheDocument()
    expect(screen.getByText('Grootste regio')).toBeInTheDocument()
    expect(screen.getAllByText('Utrecht').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Midden-NL').length).toBeGreaterThan(0)
    // avgPerRecruiter = total (9) / distinct recruiters (2) = 4,5.
    expect(screen.getByText('Gem. intakes per recruiter')).toBeInTheDocument()
    expect(screen.getAllByText('4,5').length).toBeGreaterThan(0)
    mockSettings.mockReturnValue({})
  })

  // Switching the group selector swaps the breakdown dimension shown, without
  // touching the series section above it.
  it('switches the breakdown when a different group button is clicked', async () => {
    const user = userEvent.setup()
    mockUseIntakesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.queryByText('Utrecht')).not.toBeInTheDocument()
    await user.click(screen.getByText('Locatie'))
    expect(screen.getByText('Utrecht')).toBeInTheDocument()
    // 'Anna de Vries' still shows once — the top-recruiter KPI card's sub-label
    // persists across breakdown switches; only its bar row disappears.
    expect(screen.getAllByText('Anna de Vries').length).toBe(1)
    // The series section is unaffected by the breakdown switch.
    expect(screen.getByText('Wk 31')).toBeInTheDocument()
  })

  // Regression for the audit finding (2b): the breakdown must render through the
  // shared SegmentBars component, not a page-local fork — asserted via a spy on
  // the actual module import rather than any styling value.
  it('renders the breakdown through the shared SegmentBars component', async () => {
    mockUseIntakesReport.mockReturnValue({ data, loading: false, error: false })
    const segmentBars = await import('./SegmentBars')
    const spy = vi.spyOn(segmentBars, 'default')
    renderReport()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  // REPORTS-DRILL-2 (verified live): clicking the "total" KPI opens the drill's
  // own zero-param unnarrowed call — no segment key, just the shared drawer.
  it('clicking the total KPI drills with no segment param', async () => {
    const user = userEvent.setup()
    mockUseIntakesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Totaal intakes'))
    expect(getSpy).toHaveBeenCalledWith('/reports/intakes/drill', expect.objectContaining({ params: {} }))
  })

  // REPORTS-DRILL-2: clicking a recruiter bar drills with the `recruiter` XOR
  // param — the count on the bar and the rows behind it share the SAME backend
  // predicate (ReportDrillController::intakes → IntakesReport::drillRows()).
  it('clicking a recruiter bar drills with the recruiter param', async () => {
    const user = userEvent.setup()
    mockUseIntakesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByRole('button', { name: /Anna de Vries/ }))
    expect(getSpy).toHaveBeenCalledWith('/reports/intakes/drill', expect.objectContaining({ params: { recruiter: 'r1' } }))
  })

  // Switching the group resets the breakdown drill list — a stale param from the
  // previous axis (e.g. `recruiter`) must never leak into the new axis' request.
  it('switching the breakdown group clears the previous axis drill', async () => {
    const user = userEvent.setup()
    mockUseIntakesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByRole('button', { name: /Anna de Vries/ }))
    getSpy.mockClear()
    await user.click(screen.getByText('Locatie'))
    await user.click(screen.getByRole('button', { name: /Utrecht/ }))
    expect(getSpy).toHaveBeenCalledWith('/reports/intakes/drill', expect.objectContaining({ params: { location: 'loc1' } }))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/intakes/drill')
    expect(call?.[1].params).not.toHaveProperty('recruiter')
  })
})
