/** VacanciesReport · states, axes and depth sections (split 13-11: the chart/bar drill tests moved to VacanciesReport.drills.test.tsx; the row-level drills stay here). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import VacanciesReport from './VacanciesReport'
import { row, data, dataWithKpis } from './VacanciesReport.testKit'
import type { VacanciesReportData } from '@/types/analytics'
import i18n from '@/i18n'

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

  it('shows the loading state', () => {
    mockUseVacanciesReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Vacatures laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseVacanciesReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText(i18n.t('analytics:vacancies.error'))).toBeInTheDocument()
  })

  // The shared ReportStateBlock retry button must call the hook's own refetch.
  it('retries via the hook refetch when the retry button is clicked', async () => {
    const refetch = vi.fn()
    mockUseVacanciesReport.mockReturnValue({ data: null, loading: false, error: true, refetch })
    renderReport()
    await userEvent.click(screen.getByRole('button', { name: 'Probeer opnieuw' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state when there are no vacancies', () => {
    mockUseVacanciesReport.mockReturnValue({
      data: { ...data, total: 0, vacancies: [],
        summary: { total: 0, open: 0, filled: 0, fill_rate: 0, avg_time_to_fill_days: null },
        by_status: [], by_customer: [], by_function: [], by_industry: [], by_owner: [], by_branch: [],
        timeseries: { bucket: 'week', series: [] } },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText(i18n.t('analytics:vacancies.empty'))).toBeInTheDocument()
  })

  // Contract: every axis renders every segment (incl. 'none'/'others'/orphans) and
  // sums exactly to the report total.
  it('renders every axis with every segment, each axis summing to the report total', () => {
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    for (const label of ['Wk 32', 'Wk 33', 'Gepubliceerd', 'Geen status', 'Onbekend (verwijderde status)',
      'Careyn', 'Geen klant', 'Verzorgende IG', 'Geen functie', 'Zorg',
      'Anna de Vries', 'Niet toegewezen', 'Utrecht']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // Two 'others' bars (customer + function) both render with their real label.
    expect(screen.getAllByText('Overig')).toHaveLength(2)
    expect(data.by_status.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_customer.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_function.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_industry.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_owner.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_branch.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.timeseries.series.reduce((s, p) => s + p.value, 0)).toBe(data.total)
  })

  // ADDITIVE contract: the old C-34 surface (summary tiles + per-vacancy table) keeps working.
  // SUPERSEDE 28-08: the strip is the server suite now — this pin asserts the
  // suite's OWN keys (the old one referenced the retired summary.* key, passing
  // only because both keys carried byte-identical copy) + the table rendering.
  it('renders the server-suite KPI strip and the per-vacancy table', () => {
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText(i18n.t('vacancies.kpi.total', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('vacancies.kpi.fillRate', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige IC')).toBeInTheDocument()
    expect(screen.getByText('Rivas Zorggroep')).toBeInTheDocument()
    expect(screen.getByText('VAC-1')).toBeInTheDocument()
  })

  // BELANGRIJK per contract: the window must be prominent, DD-MM-YYYY — never ISO
  // (CLAUDE.md §3B DATUM-1).
  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Vacatures 14-05-2026 t/m 14-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-05-14/)).not.toBeInTheDocument()
  })


  // DASH-FEEDS-V3 depth: the four depth sections render from the fixture, and
  // the aging row's title click drills the same as a table row (vacancy XOR).
  // Depth fields are scoped to this one test (not the shared fixture): the
  // aging table's own 'Vacature' column header would otherwise collide with
  // the main per-vacancy table's identical header across every other test.
  it('renders the four depth sections and drills an aging row on its title', async () => {
    const user = userEvent.setup()
    const depthData: VacanciesReportData = {
      ...data,
      ttf_decomposition: { published_to_first_application: 3, first_application_to_proposal: 2, proposal_to_match: 1 },
      fill_rate_timeseries: [{ date: '2026-08-01', total: 5, filled: 2, rate: 40 }],
      fill_rate_by_branch: [{ branch_id: 'b1', branch: 'Utrecht', total: 5, filled: 2, rate: 40 }],
      aging: [{ id: 'v9', title: 'Aging vacature', days_open: 42, recruiter: null, recruiter_id: null, candidates_in_process: 2, applications: 5 }],
    }
    mockUseVacanciesReport.mockReturnValue({ data: depthData, loading: false, error: false })
    renderReport()
    expect(screen.getByText(i18n.t('vacancies.depth.ttf.title', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('vacancies.depth.fillRateSeries.title', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('vacancies.depth.fillRateBranch.title', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('vacancies.depth.aging.title', { ns: 'analytics' }))).toBeInTheDocument()
    await user.click(screen.getByText('Aging vacature'))
    expect(lastDrillParams()).toEqual({ vacancy: 'v9', period: 'month' })
    expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/advice',
      expect.objectContaining({ params: { vacancy: 'v9', period: 'month' } }))
    // CMBE 0ecd0bf5: the drawer headline is row.applications (5), the full
    // drilled population — candidates_in_process (2) moves to the breakdown.
    // Scoped to the drill drawer's own dialog to avoid colliding with the
    // '5'/'Sollicitaties' text already present in the report body.
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('5')).toBeInTheDocument()
    expect(within(dialog).getByText(i18n.t('vacancies.cols.applications', { ns: 'analytics' }), { exact: false })).toBeInTheDocument()
  })

  // PDF notification signal: vacancies with zero applications get their own honest
  // section, counted from the report's own complete row set (no fabricated number).
  it('lists vacancies with zero applications in their own section, and omits it when none exist', async () => {
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // Fixture's only row has 4 applications — no zero-applicant section.
    expect(screen.queryByText('Vacatures zonder sollicitaties (1)')).not.toBeInTheDocument()

    const zeroRow = { ...row, key: 'v2', label: 'Doktersassistent', applications: 0, matched: 0 }
    mockUseVacanciesReport.mockReturnValue({ data: { ...data, vacancies: [row, zeroRow] }, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Vacatures zonder sollicitaties (1)')).toBeInTheDocument()
    // Appears once in the main table and once in the zero-applicants section.
    expect(screen.getAllByText('Doktersassistent')).toHaveLength(2)
  })

  // KPI-VAC-1: the stale_online KPI card now drills via its own kpis/drill route
  // (superseded REPORTS-DRILL-2's plain-drill `stale_online=1` XOR param — see
  // the KPI-VAC-1 suite describe block in VacanciesReport.kpiStrip.test.tsx for the shared kpi-key mechanism).
  // The zero-applicants SECTION HEADER (a different, table-driven affordance)
  // still opens the backend's own `zero_applications=1` plain drill, a DIFFERENT
  // endpoint+param than the KPI card, so the two signals never collapse onto the
  // same request.
  it('the zero-applicants section header drills with zero_applications=1 via the plain drill endpoint, distinct from the stale_online KPI card', async () => {
    const user = userEvent.setup()
    const zeroRow = { ...row, key: 'v2', label: 'Doktersassistent', applications: 0, matched: 0 }
    mockUseVacanciesReport.mockReturnValue({ data: { ...dataWithKpis, vacancies: [row, zeroRow] }, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Vacatures zonder sollicitaties (1)'))
    expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/drill',
      expect.objectContaining({ params: expect.objectContaining({ zero_applications: 1 }) }))
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/vacancies/drill' &&
      (c[1] as { params: Record<string, unknown> }).params.zero_applications === 1 &&
      'stale_online' in (c[1] as { params: Record<string, unknown> }).params)).toBe(false)

    getSpy.mockClear()
    await user.click(screen.getByText('17')) // stale_online KPI card value
    expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/kpis/drill',
      expect.objectContaining({ params: expect.objectContaining({ kpi: 'stale_online' }) }))
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/vacancies/drill')).toBe(false)
  })

  // Regression (§6): the zero-applicants header used to be a click-only <h3> with a
  // fake role/tabIndex and no key handler — Enter/Space did nothing. interactive()
  // now wires real keyboard activation, same request as a mouse click.
  it('activates the zero-applicants section header via keyboard Enter', async () => {
    const user = userEvent.setup()
    const zeroRow = { ...row, key: 'v2', label: 'Doktersassistent', applications: 0, matched: 0 }
    mockUseVacanciesReport.mockReturnValue({ data: { ...data, vacancies: [row, zeroRow] }, loading: false, error: false })
    renderReport()

    const header = screen.getByRole('button', { name: 'Vacatures zonder sollicitaties (1)' })
    header.focus()
    expect(header).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(lastDrillParams()).toEqual({ zero_applications: 1, period: 'month' })
  })

  // Integration proof (WCAG 2.2 AA audit, §6): the "Vacature" column stays wired with
  // `sortable: true` into the shared DataTable — keyboard-operable, aria-sort reflected.
  it('sorts the Vacature column via a keyboard Enter press and reflects it via aria-sort', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()

    const header = screen.getByText('Vacature').closest('th')
    expect(header).toHaveAttribute('aria-sort', 'none')

    const sortButton = screen.getByRole('button', { name: /Vacature/ })
    sortButton.focus()
    expect(sortButton).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(header).toHaveAttribute('aria-sort', 'ascending')
  })

  // RAPPORT-COMPARE-2 (§4): the compare window lives in the right-hand filter
  // panel (ReportsPage) — the page itself renders NO inline compare control.
  it('renders no inline compare control (moved to the right filter panel)', () => {
    expect(screen.queryByText('Vergelijk met')).not.toBeInTheDocument()
  })
})
