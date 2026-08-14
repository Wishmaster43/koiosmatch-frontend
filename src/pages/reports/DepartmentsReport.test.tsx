import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DepartmentsReport from './DepartmentsReport'
import type { DepartmentsReportData } from '@/types/analytics'

const mockUseDepartmentsReport = vi.fn()
vi.mock('./useDepartmentsReport', () => ({ useDepartmentsReport: () => mockUseDepartmentsReport() }))

const getSpy = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
}))

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

const lastDrillParams = () =>
  (getSpy.mock.calls.filter(c => c[0] === '/reports/departments/drill').at(-1)?.[1] as { params: Record<string, unknown> }).params

// The house LineChartCard needs real layout (jsdom has none) so the timeseries
// wrapper is mocked exactly like WeeklyBarChartCard in TrendsRow.test.tsx: one
// button per point, same label text, onPick fired with the raw date key.
vi.mock('./ReportTimeseriesChart', () => ({
  default: ({ series, onPick }: { series: { date: string; label: string; value: number }[]; onPick?: (date: string) => void }) => (
    <>{series.map(p => <button key={p.date} onClick={() => onPick?.(p.date)}>{p.label}</button>)}</>
  ),
}))

describe('DepartmentsReport (RAPPORTEN-SUITE-2 departments report)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

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
    for (const label of ['Wk 31', 'Wk 32', 'Actief', 'Onbekend (geen status)',
      'Yesway Flex', 'Geen klant', 'Utrecht', 'Geen locatie']) {
      expect(screen.getByText(label)).toBeInTheDocument()
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

  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Afdelingen 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  it('clicking each axis drills with its own XOR param', async () => {
    const user = userEvent.setup()
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    expect(lastDrillParams()).toEqual({ status: 'status-1', period: 'month' })
    await user.click(screen.getByText('Yesway Flex'))
    expect(lastDrillParams()).toEqual({ customer: 'cust-1', period: 'month' })
    await user.click(screen.getByText('Utrecht'))
    expect(lastDrillParams()).toEqual({ location: 'loc-1', period: 'month' })
    // Report drill endpoints only — never an entity list route.
    expect(getSpy.mock.calls.some(c => String(c[0]).startsWith('/customers'))).toBe(false)
  })

  it('sends exactly one XOR param per drill call, in both directions across axes', async () => {
    const user = userEvent.setup()
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    expect(lastDrillParams()).toEqual({ status: 'status-1', period: 'month' })
    await user.click(screen.getByText('Utrecht'))
    expect(lastDrillParams()).toEqual({ location: 'loc-1', period: 'month' })
    await user.click(screen.getByText('Actief'))
    expect(lastDrillParams()).toEqual({ status: 'status-1', period: 'month' })
  })

  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 31'))
    expect(lastDrillParams()).toEqual({ date: '2026-08-01', bucket: 'week', period: 'month' })
  })

  it('always drills via /reports/departments/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    await user.click(screen.getByText('Yesway Flex'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/departments/drill' || c[0] === '/reports/departments/advice')).toBe(true)
  })

  // Calm 403 degrade: the drill rows need customers.view on top of reports.view.
  it('keeps the advice visible when the rows request is 403-forbidden', async () => {
    const user = userEvent.setup()
    getSpy.mockImplementation((url: unknown) => String(url).endsWith('/drill')
      ? Promise.reject({ response: { status: 403 } })
      : Promise.resolve({ data: { advice: 'Bekijk deze groep afdelingen.' } }))
    mockUseDepartmentsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    await waitFor(() => expect(screen.getByText('Bekijk deze groep afdelingen.')).toBeInTheDocument())
    expect(screen.queryByText('Onderliggende records')).not.toBeInTheDocument()
    expect(screen.queryByText(/fout|mislukt|error|forbidden/i)).not.toBeInTheDocument()
  })
})
