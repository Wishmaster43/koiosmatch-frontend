import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LocationsReport from './LocationsReport'
import type { LocationsReportData } from '@/types/analytics'

const mockUseLocationsReport = vi.fn()
vi.mock('./useLocationsReport', () => ({ useLocationsReport: () => mockUseLocationsReport() }))

const getSpy = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
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

const lastDrillParams = () =>
  (getSpy.mock.calls.filter(c => c[0] === '/reports/locations/drill').at(-1)?.[1] as { params: Record<string, unknown> }).params

// The house LineChartCard needs real layout (jsdom has none) so the timeseries
// wrapper is mocked exactly like WeeklyBarChartCard in TrendsRow.test.tsx: one
// button per point, same label text, onPick fired with the raw date key.
vi.mock('./ReportTimeseriesChart', () => ({
  default: ({ series, onPick }: { series: { date: string; label: string; value: number }[]; onPick?: (date: string) => void }) => (
    <>{series.map(p => <button key={p.date} onClick={() => onPick?.(p.date)}>{p.label}</button>)}</>
  ),
}))

describe('LocationsReport (RAPPORTEN-SUITE-2 locations report)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

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

  // Nine-card footprint (Danny's "negen KPI rows"): without the optional
  // `summary` block, the honest maximum is seven (no withDepartments/without
  // Departments cards) — never a fabricated 0 for a block that never arrived.
  it('ships seven honest cards when the optional summary block is absent', () => {
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.queryByText('Met afdelingen')).not.toBeInTheDocument()
    expect(screen.queryByText('Zonder afdelingen')).not.toBeInTheDocument()
    expect(screen.getByText('Zonder plaats')).toBeInTheDocument()
    expect(screen.getByText('Grootste plaats')).toBeInTheDocument()
    expect(screen.getByText('Zonder provincie')).toBeInTheDocument()
    expect(screen.getByText('Grootste provincie')).toBeInTheDocument()
  })

  // With the summary block present, the two department-coverage cards join in
  // for the full nine — real numbers straight off the fixture's summary.
  it('adds the department-coverage cards when the summary block arrives', () => {
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

  it('clicking the "Grootste plaats" KPI card drills with city=<value> (XOR)', async () => {
    const user = userEvent.setup()
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Grootste plaats'))
    expect(lastDrillParams()).toEqual({ city: 'Utrecht', period: 'month' })
  })

  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Locaties 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  it('clicking each axis drills with its own XOR param', async () => {
    const user = userEvent.setup()
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    expect(lastDrillParams()).toEqual({ status: 'status-1', period: 'month' })
    await user.click(screen.getByText('Yesway Flex'))
    expect(lastDrillParams()).toEqual({ customer: 'cust-1', period: 'month' })
    await user.click(screen.getAllByText('Utrecht').at(-1)!)
    expect(lastDrillParams()).toEqual({ city: 'Utrecht', period: 'month' })
    await user.click(screen.getAllByText('Noord-Holland').at(-1)!)
    expect(lastDrillParams()).toEqual({ province: 'Noord-Holland', period: 'month' })
    // Report drill endpoints only — never an entity list route.
    expect(getSpy.mock.calls.some(c => String(c[0]).startsWith('/customers'))).toBe(false)
  })

  it('sends exactly one XOR param per drill call, in both directions across axes', async () => {
    const user = userEvent.setup()
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    expect(lastDrillParams()).toEqual({ status: 'status-1', period: 'month' })
    await user.click(screen.getByText('Yesway Flex'))
    expect(lastDrillParams()).toEqual({ customer: 'cust-1', period: 'month' })
    await user.click(screen.getByText('Actief'))
    expect(lastDrillParams()).toEqual({ status: 'status-1', period: 'month' })
  })

  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 31'))
    expect(lastDrillParams()).toEqual({ date: '2026-08-01', bucket: 'week', period: 'month' })
  })

  it('always drills via /reports/locations/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    await user.click(screen.getByText('Yesway Flex'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/locations/drill' || c[0] === '/reports/locations/advice')).toBe(true)
  })

  // Calm 403 degrade: the drill rows need customers.view on top of reports.view.
  it('keeps the advice visible when the rows request is 403-forbidden', async () => {
    const user = userEvent.setup()
    getSpy.mockImplementation((url: unknown) => String(url).endsWith('/drill')
      ? Promise.reject({ response: { status: 403 } })
      : Promise.resolve({ data: { advice: 'Bekijk deze groep locaties.' } }))
    mockUseLocationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    await waitFor(() => expect(screen.getByText('Bekijk deze groep locaties.')).toBeInTheDocument())
    expect(screen.queryByText('Onderliggende records')).not.toBeInTheDocument()
    expect(screen.queryByText(/fout|mislukt|error|forbidden/i)).not.toBeInTheDocument()
  })
})
