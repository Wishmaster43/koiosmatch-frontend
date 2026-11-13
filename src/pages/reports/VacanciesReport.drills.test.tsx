/** VacanciesReport · drills: the request each bar, bucket and row click sends (split from VacanciesReport.test.tsx; the outer describe title is deliberately repeated so full test names stay identical). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import VacanciesReport from './VacanciesReport'
import { data } from './VacanciesReport.testKit'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseVacanciesReport = vi.fn()
vi.mock('./useVacanciesReport', () => ({ useVacanciesReport: (...args: unknown[]) => mockUseVacanciesReport(...args) }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket/row click sends — mutation tests must
// assert the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// Mock useReportKpiSelection hook to return default KPI order
const mockUseReportKpiSelection = vi.fn(() => ({ data: ['status', 'lead_source', 'region', 'required_function', 'contract_form', 'language', 'level', 'experience', 'no_cv'] as string[], isLoading: false }))
vi.mock('./hooks/useReportKpiSelection', () => ({ useReportKpiSelection: () => mockUseReportKpiSelection() }))

// Tenant KPI-order settings, controllable per test (RAPPORT-KPI-INSTELBAAR).
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <VacanciesReport period="month" />
    </QueryClientProvider>,
  )
}

// The last drill call's raw params — for the XOR proofs (exactly ONE segment param).
const lastDrillParams = () =>
  (getSpy.mock.calls.filter(c => c[0] === '/reports/vacancies/drill').at(-1)?.[1] as { params: Record<string, unknown> }).params

// The house LineChartCard needs real layout (jsdom has none) so the timeseries
// wrapper is mocked exactly like WeeklyBarChartCard in TrendsRow.test.tsx: one
// button per point, same label text, onPick fired with the raw date key.
vi.mock('./ReportTimeseriesChart', () => ({
  default: ({ series, onPick }: { series: { date: string; label: string; value: number }[]; onPick?: (date: string) => void }) => (
    <>{series.map(p => <button key={p.date} onClick={() => onPick?.(p.date)}>{p.label}</button>)}</>
  ),
}))

// RAPPORT-GEZICHT-WAVE2: the Recharts house charts need real layout (jsdom has
// none) — stubs expose the exact click contract the real components deliver
// (donut: the datum incl. `key`; bar: the original ChartDatum). Mirrors
// CandidatesReport.test.tsx's stub 1:1.
type StubDatum = { name: string; value: number; key?: string }
vi.mock('@/components/charts/PieChartCard', () => ({
  default: ({ data, onItemClick }: { data?: StubDatum[]; onItemClick?: (d: unknown) => void }) => (
    <>{(data ?? []).map(d => <button key={d.key} onClick={() => onItemClick?.(d)}>{d.name}</button>)}</>
  ),
}))
vi.mock('@/components/charts/BarChartCard', () => ({
  default: ({ data, onBarClick }: { data?: StubDatum[]; onBarClick?: (d: StubDatum) => void }) => (
    <>{(data ?? []).map(d => <button key={d.key} onClick={() => onBarClick?.(d)}>{d.name}</button>)}</>
  ),
}))

describe('VacanciesReport (RAPPORTEN-SUITE-1 portie 4, additive on C-34)', () => {
  beforeEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  // RAPPORT-FILTERS-2: the panel's active filters reach BOTH the report hook and
  // a drill click — bar and lade can never disagree (mirrors CandidatesReport).
  it('sends the active panel filters to BOTH the report hook and a drill click', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    const filters = { status: ['open-uuid'], ownerId: ['u1'], locationId: [7], customerId: ['c1'] }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <VacanciesReport period="month" filters={filters} />
      </QueryClientProvider>,
    )
    expect(mockUseVacanciesReport).toHaveBeenCalledWith('month', filters)
    await user.click(screen.getByText('Utrecht'))
    expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/drill', expect.objectContaining({
      params: { period: 'month', status: ['open-uuid'], owner_id: ['u1'], location_id: [7], customer_id: ['c1'], branch: 'utrecht' },
    }))
  })

  it('clicking a status bar drills with the status XOR param (drill + advice)', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Gepubliceerd'))
    expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/drill',
      expect.objectContaining({ params: { status: 'st-uuid-1', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/advice',
      expect.objectContaining({ params: { status: 'st-uuid-1', period: 'month' } }))
  })

  // 'none' sentinel: drills with the axis param only — NO other XOR param rides along.
  it('clicking the "Geen status" sentinel drills with status=none and no other XOR param', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Geen status'))
    expect(lastDrillParams()).toEqual({ status: 'none', period: 'month' })
  })

  // Orphan-value drill: a deleted vacancy-status lookup row still renders its own bar
  // with the backend's "Onbekend (…)" label and drills on the RAW uuid.
  it('renders an orphaned (deleted-lookup) status as its own bar and drills on the raw uuid', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend (verwijderde status)'))
    expect(lastDrillParams()).toEqual({ status: '9c1d-deleted-status-uuid', period: 'month' })
  })

  // 'others' = the exact complement of the top-10 — a real, clickable row.
  it('clicking the customer "Overig" bar drills with customer=others', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    const [customerOthers] = screen.getAllByText('Overig')
    await user.click(customerOthers)
    expect(lastDrillParams()).toEqual({ customer: 'others', period: 'month' })
  })

  it('clicking the customer "Geen klant" bar drills with customer=none', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Geen klant'))
    expect(lastDrillParams()).toEqual({ customer: 'none', period: 'month' })
  })

  // Function is a raw-string axis: the string is the drill value AND the label.
  it('clicking a function bar drills on the raw string with the function param', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Verzorgende IG'))
    expect(lastDrillParams()).toEqual({ function: 'Verzorgende IG', period: 'month' })
  })

  // Industry is zero-filled over the lookup on NAME strings — the name is the value.
  it('clicking an industry bar drills with the industry NAME string', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Zorg'))
    expect(lastDrillParams()).toEqual({ industry: 'Zorg', period: 'month' })
  })

  it('clicking an owner bar drills with the owner XOR param (D2 shape: owner_id → owner)', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Anna de Vries'))
    expect(lastDrillParams()).toEqual({ owner: 'u1', period: 'month' })
  })

  // VESTIGING-2: the branch axis groups via the CUSTOMER's mirrored branch and drills
  // through the REPORT drill's `branch` param — never the /vacancies list filter.
  it('clicking the branch bar drills via /reports/vacancies/drill with branch=, never a /vacancies list call', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Utrecht'))
    expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/drill',
      expect.objectContaining({ params: { branch: 'utrecht', period: 'month' } }))
    expect(getSpy.mock.calls.some(c => String(c[0]).startsWith('/vacancies'))).toBe(false)
  })

  // GRANULARITY role of `bucket` (dual-role contract): a week timeseries bar drills
  // with date=<key> + bucket=week so bar and drawer totals always agree.
  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 32'))
    expect(lastDrillParams()).toEqual({ date: '2026-08-03', bucket: 'week', period: 'month' })
  })

  it('omits bucket when the timeseries is day-granular', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({
      data: { ...data, timeseries: { bucket: 'day', series: [{ date: '2026-08-03', label: '03-08', value: 2 }] } },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('03-08'))
    expect(lastDrillParams()).toEqual({ date: '2026-08-03', period: 'month' })
  })

  // Legacy 'vacancy' segment (unchanged C-34 behaviour): a table row drills into that
  // vacancy's own APPLICATION rows via the vacancy XOR param.
  it('clicking a table row still drills with vacancy=<key> (application rows)', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Verpleegkundige IC'))
    expect(lastDrillParams()).toEqual({ vacancy: 'v1', period: 'month' })
    expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/advice',
      expect.objectContaining({ params: { vacancy: 'v1', period: 'month' } }))
  })
})
