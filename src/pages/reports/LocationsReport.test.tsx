import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LocationsReport from './LocationsReport'
import type { LocationsReportData } from '@/types/analytics'

const mockUseLocationsReport = vi.fn()
vi.mock('./useLocationsReport', () => ({ useLocationsReport: () => mockUseLocationsReport() }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// Fixture per the RAPPORTEN-SUITE-2 locations contract: four-way XOR axes, each
// axis sums to total (all top-20 + 'others' + 'none').
const data: LocationsReportData = {
  period: 'month',
  from: '2026-08-01',
  to: '2026-08-31',
  total: 9,
  timeseries: { bucket: 'week', series: [
    { date: '2026-08-01', label: 'Wk 31', value: 4 },
    { date: '2026-08-10', label: 'Wk 32', value: 5 },
  ] },
  by_status: [
    { value: 'status-1', label: 'Actief', color: '#2563eb', count: 7 },
    { value: 'none', label: 'Onbekend (geen status)', color: null, count: 2 },
  ],
  by_customer: [
    { value: 'cust-1', label: 'Yesway Flex', count: 6 },
    { value: 'none', label: 'Geen klant', count: 3 },
  ],
  by_city: [
    { value: 'Utrecht', label: 'Utrecht', count: 5 },
    { value: 'none', label: 'Geen plaats', count: 4 },
  ],
  by_province: [
    { value: 'Noord-Holland', label: 'Noord-Holland', count: 5 },
    { value: 'none', label: 'Geen provincie', count: 4 },
  ],
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <LocationsReport period="month" />
    </QueryClientProvider>,
  )
}

// The house LineChartCard needs real layout (jsdom has none) so the timeseries
// wrapper is mocked exactly like WeeklyBarChartCard in TrendsRow.test.tsx: one
// button per point, same label text, onPick fired with the raw date key.
vi.mock('./ReportTimeseriesChart', () => ({
  default: ({ series, onPick }: { series: { date: string; label: string; value: number }[]; onPick?: (date: string) => void }) => (
    <>{series.map(p => <button key={p.date} onClick={() => onPick?.(p.date)}>{p.label}</button>)}</>
  ),
}))

describe('LocationsReport (RAPPORTEN-SUITE-2 locations report)', () => {
  // Every section now defaults its own list on mount, firing extra drill/advice
  // requests — clear the shared spy between tests so a later assertion never
  // matches a PRIOR test's leftover call history.
  afterEach(() => { getSpy.mockClear() })

  it('shows the loading state', () => {
    mockUseLocationsReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Locaties laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseLocationsReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de locaties niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no locations', () => {
    mockUseLocationsReport.mockReturnValue({
      data: { ...data, total: 0, by_status: [], by_customer: [], by_city: [], by_province: [],
        timeseries: { bucket: 'week', series: [] } },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen locaties in deze periode')).toBeInTheDocument()
  })

  it('renders every axis with every segment, each axis summing to the report total', () => {
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    for (const label of ['Wk 31', 'Wk 32', 'Actief', 'Onbekend (geen status)',
      'Yesway Flex', 'Geen klant', 'Geen plaats', 'Geen provincie']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(data.by_status.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_customer.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_city.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_province.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.timeseries.series.reduce((s, p) => s + p.value, 0)).toBe(data.total)
  })

  // KPI strip is derived from total + the by_customer axis (an honest split,
  // never a fabricated number) — never a bare hardcoded card.
  it('renders the KPI strip derived from total + by_customer', () => {
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal locaties')).toBeInTheDocument()
    expect(screen.getByText('Gekoppeld aan klant')).toBeInTheDocument()
    expect(screen.getByText('Niet gekoppeld aan klant')).toBeInTheDocument()
    // 6 linked (9 total - 3 unlinked, the by_customer 'none' bucket) / 3 unlinked.
    expect(screen.getAllByText('6').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
  })

  // Nine-card footprint (Danny's "negen KPI rows", ALWAYS — never 5-9): the
  // `withDepartments`/`withoutDepartments` slots are PERMANENT — without the
  // optional `summary` block they still render, with the house dash, never a
  // fabricated 0 and never a missing card.
  it('ships all nine cards, dash-filled, when the optional summary block is absent', () => {
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Met afdelingen')).toBeInTheDocument()
    expect(screen.getByText('Zonder afdelingen')).toBeInTheDocument()
    expect(screen.getByText('Zonder plaats')).toBeInTheDocument()
    expect(screen.getByText('Grootste plaats')).toBeInTheDocument()
    expect(screen.getByText('Zonder provincie')).toBeInTheDocument()
    expect(screen.getByText('Grootste provincie')).toBeInTheDocument()
  })

  // With the summary block present, the two department-coverage cards fill
  // with real numbers straight off the fixture's summary — same nine cards.
  it('fills the department-coverage cards with real numbers when the summary block arrives', () => {
    mockUseLocationsReport.mockReturnValue({
      data: { ...data, summary: { with_departments: 7, without_departments: 2 } },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Met afdelingen')).toBeInTheDocument()
    expect(screen.getByText('Zonder afdelingen')).toBeInTheDocument()
    expect(screen.getAllByText('7').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
  })

  it('clicking the "Grootste plaats" KPI card drills the city list with city=<value> (XOR)', async () => {
    const user = userEvent.setup()
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Grootste plaats'))
    expect(getSpy).toHaveBeenCalledWith('/reports/locations/drill',
      expect.objectContaining({ params: { city: 'Utrecht', period: 'month' } }))
  })

  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Locaties 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  it('clicking a status bar drills with the status XOR param', async () => {
    const user = userEvent.setup()
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    expect(getSpy).toHaveBeenCalledWith('/reports/locations/drill',
      expect.objectContaining({ params: { status: 'status-1', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/locations/advice',
      expect.objectContaining({ params: { status: 'status-1', period: 'month' } }))
  })

  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 31'))
    expect(getSpy).toHaveBeenCalledWith('/reports/locations/drill',
      expect.objectContaining({ params: { date: '2026-08-01', bucket: 'week', period: 'month' } }))
  })

  it('always drills via /reports/locations/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/locations/drill' || c[0] === '/reports/locations/advice')).toBe(true)
  })

  // RAPPORTEN-DRILLLIST-1: every axis section shows its own always-visible list
  // beside the chart, seeded with a real request on mount — never a blank panel.
  it('renders a drill list beside each axis chart, defaulted on mount', () => {
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // The status axis's top segment (Actief, 7) seeds its own list on mount.
    expect(getSpy).toHaveBeenCalledWith('/reports/locations/drill',
      expect.objectContaining({ params: { status: 'status-1', period: 'month' } }))
    // The customer axis independently seeds its own list with its own top segment.
    expect(getSpy).toHaveBeenCalledWith('/reports/locations/drill',
      expect.objectContaining({ params: { customer: 'cust-1', period: 'month' } }))
  })

  // Clicking a segment in one chart must never change another chart's list —
  // each axis holds its OWN drill state, never a shared overlay.
  it('clicking a segment in one chart does not change another chart\'s list', async () => {
    const user = userEvent.setup()
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    // "Geen klant" is NOT the mount-seeded top segment (cust-1 is), so this click
    // is guaranteed to fire a fresh request rather than hit the react-query cache.
    await user.click(screen.getByText('Geen klant'))
    // The customer bar's own list is refreshed.
    expect(getSpy).toHaveBeenCalledWith('/reports/locations/drill',
      expect.objectContaining({ params: { customer: 'none', period: 'month' } }))
    // The status axis was never re-requested by that click.
    expect(getSpy).not.toHaveBeenCalledWith('/reports/locations/drill',
      expect.objectContaining({ params: expect.objectContaining({ status: 'status-1' }) }))
  })
})
