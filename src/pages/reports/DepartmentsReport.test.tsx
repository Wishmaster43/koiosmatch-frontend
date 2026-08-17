import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DepartmentsReport from './DepartmentsReport'
import type { DepartmentsReportData } from '@/types/analytics'

const mockUseDepartmentsReport = vi.fn()
vi.mock('./useDepartmentsReport', () => ({ useDepartmentsReport: () => mockUseDepartmentsReport() }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// Tenant KPI-order settings (RAPPORT-KPI-INSTELBAAR) — empty blob = today's
// default order, unless a test overrides it (REPORTS-KPI-SPARE-2 tests below).
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

// Fixture per the RAPPORTEN-SUITE-2 departments contract: three-way XOR axes,
// each axis sums to total.
const data: DepartmentsReportData = {
  period: 'month',
  from: '2026-08-01',
  to: '2026-08-31',
  total: 8,
  timeseries: { bucket: 'week', series: [
    { date: '2026-08-01', label: 'Wk 31', value: 3 },
    { date: '2026-08-10', label: 'Wk 32', value: 5 },
  ] },
  by_status: [
    { value: 'status-1', label: 'Actief', color: '#2563eb', count: 6 },
    { value: 'none', label: 'Onbekend (geen status)', color: null, count: 2 },
  ],
  by_customer: [
    { value: 'cust-1', label: 'Yesway Flex', count: 5 },
    { value: 'none', label: 'Geen klant', count: 3 },
  ],
  by_location: [
    { value: 'loc-1', label: 'Utrecht', count: 5 },
    { value: 'none', label: 'Geen locatie', count: 3 },
  ],
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <DepartmentsReport period="month" />
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

describe('DepartmentsReport (RAPPORTEN-SUITE-2 departments report)', () => {
  // Every section now defaults its own list on mount, firing extra drill/advice
  // requests — clear the shared spy between tests so a later assertion never
  // matches a PRIOR test's leftover call history.
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  it('shows the loading state', () => {
    mockUseDepartmentsReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Afdelingen laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseDepartmentsReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de afdelingen niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no departments', () => {
    mockUseDepartmentsReport.mockReturnValue({
      data: { ...data, total: 0, by_status: [], by_customer: [], by_location: [],
        timeseries: { bucket: 'week', series: [] } },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen afdelingen in deze periode')).toBeInTheDocument()
  })

  it('renders every axis with every segment, each axis summing to the report total', () => {
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // getAllByText: 'Yesway Flex'/'Utrecht' now double as the topCustomer/
    // topLocation KPI-card sub-labels — presence, not uniqueness, is proven here.
    for (const label of ['Wk 31', 'Wk 32', 'Actief', 'Onbekend (geen status)',
      'Yesway Flex', 'Geen klant', 'Utrecht', 'Geen locatie']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    expect(data.by_status.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_customer.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_location.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.timeseries.series.reduce((s, p) => s + p.value, 0)).toBe(data.total)
  })

  // KPI strip is derived from total + the by_location axis (an honest split,
  // never a fabricated number).
  it('renders the KPI strip derived from total + by_location', () => {
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal afdelingen')).toBeInTheDocument()
    expect(screen.getByText('Gekoppeld aan locatie')).toBeInTheDocument()
    expect(screen.getByText('Niet gekoppeld aan locatie')).toBeInTheDocument()
    // 5 linked (8 total - 3 unlinked, the by_location 'none' bucket) / 3 unlinked.
    expect(screen.getAllByText('5').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
  })

  // Nine-card footprint (Danny's "negen KPI rows", ALWAYS — never 5-9): the
  // `withContacts`/`withoutContacts` slots are PERMANENT — without the optional
  // `summary` block they still render, with the house dash, never a fabricated
  // 0 and never a missing card.
  it('ships all nine cards, dash-filled, when the optional summary block is absent', () => {
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Met contacten')).toBeInTheDocument()
    expect(screen.getByText('Zonder contacten')).toBeInTheDocument()
    expect(screen.getByText('Zonder klant')).toBeInTheDocument()
    expect(screen.getByText('Grootste klant')).toBeInTheDocument()
    expect(screen.getByText('Grootste locatie')).toBeInTheDocument()
    expect(screen.getByText('Aantal klanten')).toBeInTheDocument()
    expect(screen.getAllByText('1').length).toBeGreaterThan(0) // customersCount (1 real customer, 'none' excluded)
  })

  // With the summary block present, the two contact-coverage cards fill with
  // real numbers straight off the fixture's summary — same nine cards, no dash.
  it('fills the contact-coverage cards with real numbers when the summary block arrives', () => {
    mockUseDepartmentsReport.mockReturnValue({
      data: { ...data, summary: { with_contacts: 6, without_contacts: 2 } },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Met contacten')).toBeInTheDocument()
    expect(screen.getByText('Zonder contacten')).toBeInTheDocument()
    expect(screen.getAllByText('6').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
  })

  // REPORTS-KPI-SPARE-2: `withCustomer` is the honest complement of the
  // existing `withoutCustomer` card; the two rates are honest ratios over
  // counts already in the strip; `othersCustomer` is the by_customer axis's
  // own real 'others' rollup bucket.
  it('renders withCustomer/othersCustomer and the two coverage rates when swapped in', () => {
    mockSettings.mockReturnValue({
      report_kpis_departments: JSON.stringify(['withCustomer', 'locationCoverageRate', 'contactCoverageRate', 'othersCustomer',
        'withLocation', 'withoutLocation', 'withoutCustomer', 'topCustomer', 'topLocation']),
    })
    mockUseDepartmentsReport.mockReturnValue({
      data: {
        ...data,
        by_customer: [
          { value: 'cust-1', label: 'Yesway Flex', count: 5 },
          { value: 'others', label: 'Overig', count: 2 },
          { value: 'none', label: 'Geen klant', count: 1 },
        ],
        summary: { with_contacts: 6, without_contacts: 2 },
      },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Gekoppeld aan klant')).toBeInTheDocument()
    expect(screen.getAllByText('7').length).toBeGreaterThan(0) // total(8) - withoutCustomer(1)
    expect(screen.getByText('Dekking locatie')).toBeInTheDocument()
    expect(screen.getByText('62,5%')).toBeInTheDocument() // withLocation(5)/total(8)
    expect(screen.getByText('Dekking contacten')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument() // with_contacts(6)/total(8)
    expect(screen.getByText('Overige klanten')).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
  })

  it('clicking "Overige klanten" drills the customer list with customer=others (XOR)', async () => {
    const user = userEvent.setup()
    mockSettings.mockReturnValue({
      report_kpis_departments: JSON.stringify(['withCustomer', 'locationCoverageRate', 'contactCoverageRate', 'othersCustomer',
        'withLocation', 'withoutLocation', 'withoutCustomer', 'topCustomer', 'topLocation']),
    })
    mockUseDepartmentsReport.mockReturnValue({
      data: { ...data, by_customer: [
        { value: 'cust-1', label: 'Yesway Flex', count: 5 },
        { value: 'others', label: 'Overig', count: 2 },
        { value: 'none', label: 'Geen klant', count: 1 },
      ] },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('Overige klanten'))
    expect(getSpy).toHaveBeenCalledWith('/reports/departments/drill',
      expect.objectContaining({ params: { customer: 'others', period: 'month' } }))
  })

  it('clicking the "Grootste klant" KPI card drills the customer list with customer=<value> (XOR)', async () => {
    const user = userEvent.setup()
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Grootste klant'))
    expect(getSpy).toHaveBeenCalledWith('/reports/departments/drill',
      expect.objectContaining({ params: { customer: 'cust-1', period: 'month' } }))
  })

  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Afdelingen 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  it('clicking a status bar drills with the status XOR param', async () => {
    const user = userEvent.setup()
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    expect(getSpy).toHaveBeenCalledWith('/reports/departments/drill',
      expect.objectContaining({ params: { status: 'status-1', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/departments/advice',
      expect.objectContaining({ params: { status: 'status-1', period: 'month' } }))
    // Report drill endpoints only — never an entity list route.
    expect(getSpy.mock.calls.some(c => String(c[0]).startsWith('/customers'))).toBe(false)
  })

  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 31'))
    expect(getSpy).toHaveBeenCalledWith('/reports/departments/drill',
      expect.objectContaining({ params: { date: '2026-08-01', bucket: 'week', period: 'month' } }))
  })

  it('always drills via /reports/departments/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/departments/drill' || c[0] === '/reports/departments/advice')).toBe(true)
  })

  // RAPPORTEN-DRILLLIST-1: every axis section shows its own always-visible list
  // beside the chart, seeded with a real request on mount — never a blank panel.
  it('renders a drill list beside each axis chart, defaulted on mount', () => {
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // The status axis's top segment (Actief, 6) seeds its own list on mount.
    expect(getSpy).toHaveBeenCalledWith('/reports/departments/drill',
      expect.objectContaining({ params: { status: 'status-1', period: 'month' } }))
    // The customer axis independently seeds its own list with its own top segment.
    expect(getSpy).toHaveBeenCalledWith('/reports/departments/drill',
      expect.objectContaining({ params: { customer: 'cust-1', period: 'month' } }))
  })

  // Clicking a segment in one chart must never change another chart's list —
  // each axis holds its OWN drill state, never a shared overlay.
  it('clicking a segment in one chart does not change another chart\'s list', async () => {
    const user = userEvent.setup()
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    // "Geen locatie" is NOT the mount-seeded top segment (loc-1 is), so this
    // click is guaranteed to fire a fresh request rather than hit the cache.
    await user.click(screen.getByText('Geen locatie'))
    // The location bar's own list is refreshed.
    expect(getSpy).toHaveBeenCalledWith('/reports/departments/drill',
      expect.objectContaining({ params: { location: 'none', period: 'month' } }))
    // The status axis was never re-requested by that click.
    expect(getSpy).not.toHaveBeenCalledWith('/reports/departments/drill',
      expect.objectContaining({ params: expect.objectContaining({ status: 'status-1' }) }))
  })
})
