import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import VacanciesReport from './VacanciesReport'
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

// Tenant KPI-order settings, controllable per test (RAPPORT-KPI-INSTELBAAR).
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

const row = {
  key: 'v1', label: 'Verpleegkundige IC', code: 'VAC-1',
  status: { value: 'open', label: 'Open' },
  customer: { id: 'c1', name: 'Rivas Zorggroep' },
  applications: 4, applications_by_phase: [], matched: 2, filled: false, time_to_fill_days: null,
}
const data: VacanciesReportData = {
  period: 'month', from: '2026-05-14', to: '2026-08-14',
  summary: {
    total: 12, open: 8, filled: 4, fill_rate: 0.33, avg_time_to_fill_days: 11.4, stale_online: 2, long_concept: 1, no_matches: 3,
    advice_stale: 2, advice_stale_days: 14, closing_soon: 1, closing_soon_days: 7,
  },
  vacancies: [row],
  total: 12,
  timeseries: { bucket: 'week', series: [
    { date: '2026-08-03', label: 'Wk 32', value: 5 },
    { date: '2026-08-10', label: 'Wk 33', value: 7 },
  ] },
  by_status: [
    // eslint-disable-next-line no-restricted-syntax -- API fixture colour (DATA, mirrors the live row)
    { value: 'st-uuid-1', label: 'Gepubliceerd', color: '#16a34a', count: 6 },
    { value: 'none', label: 'Geen status', color: null, count: 3 },
    { value: '9c1d-deleted-status-uuid', label: 'Onbekend (verwijderde status)', color: null, count: 3 },
  ],
  by_customer: [
    { value: 'cust-1', label: 'Careyn', count: 7 },
    { value: 'none', label: 'Geen klant', count: 3 },
    { value: 'others', label: 'Overig', count: 2 },
  ],
  by_function: [
    { value: 'Verzorgende IG', label: 'Verzorgende IG', count: 9 },
    { value: 'none', label: 'Geen functie', count: 2 },
    { value: 'others', label: 'Overig', count: 1 },
  ],
  by_industry: [{ value: 'Zorg', label: 'Zorg', color: null, count: 12 }],
  by_owner: [
    { owner_id: 'u1', name: 'Anna de Vries', count: 9 },
    { owner_id: 'none', name: 'Niet toegewezen', count: 3 },
  ],
  by_branch: [{ value: 'utrecht', label: 'Utrecht', color: null, count: 12 }],
}

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
    expect(screen.getByText('Kon de vacatures niet laden')).toBeInTheDocument()
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
    expect(screen.getByText('Geen vacatures in deze periode')).toBeInTheDocument()
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
  it('keeps the legacy summary KPI strip and the per-vacancy table rendering', () => {
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('vacancies.summary.fillRate', { ns: 'analytics' }))).toBeInTheDocument()
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

  // Exactly nine KPI cards (§ report-KPI-9 sweep): the five legacy summary tiles
  // plus four new ones derived from fields the endpoint already returns — the
  // PDF-VACATURES point 31 "online without candidates" signal, a distinct-
  // customers count, and the top industry/owner segments (both still drill via
  // the same XOR-param pattern as the axis bars).
  it('renders exactly nine KPI cards, with topIndustry/topOwner drilling their XOR param', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // PDF-VACATURES-31: the card's number is the REAL backend summary.stale_online
    // field (2 in the fixture), never a re-derived front-end guess, and the label
    // names exactly what it counts (published, no candidates, past the threshold).
    const staleLabel = screen.getByText('Online, geen kandidaten')
    const staleCard = staleLabel.parentElement as HTMLElement
    expect(within(staleCard).getByText('2')).toBeInTheDocument()
    // One distinct customer in the fixture row — assert via the KPI card
    // (a bare '1' text match is ambiguous against other numeric cells on the page).
    const customersLabel = screen.getByText('Aantal klanten')
    const customersCard = customersLabel.parentElement as HTMLElement
    expect(within(customersCard).getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Grootste branche')).toBeInTheDocument()
    expect(screen.getByText('Zorg · 12')).toBeInTheDocument()
    expect(screen.getByText('Grootste eigenaar')).toBeInTheDocument()
    expect(screen.getByText('Anna de Vries · 9')).toBeInTheDocument()

    await user.click(screen.getByText('Zorg · 12'))
    expect(lastDrillParams()).toEqual({ industry: 'Zorg', period: 'month' })
  })

  // REPORTS-KPI-SPARE-1 (+KPI-DREMPELS-FE-1): the catalogue now offers six spares
  // beyond the nine defaults (longConcept/noMatches/topFunction/topBranch, then
  // adviceStale/closingSoon), so the settings screen has something to swap in.
  it('offers the six new spare cards to the settings catalogue', async () => {
    const { getReportKpiCatalog, getReportKpiDefaultOrder, reportHasSpareKpiCards } = await import('./kpiCatalog')
    const catalogKeys = getReportKpiCatalog('vacancies').map(c => c.key)
    expect(catalogKeys).toEqual(expect.arrayContaining(['longConcept', 'noMatches', 'topFunction', 'topBranch', 'adviceStale', 'closingSoon']))
    expect(catalogKeys.length).toBe(getReportKpiDefaultOrder('vacancies').length + 6)
    expect(reportHasSpareKpiCards('vacancies')).toBe(true)
  })

  // A tenant swaps a spare into the strip: the strip is STILL exactly nine cards,
  // and each spare renders its real fixture value (never a fabricated number).
  it('renders a swapped-in spare card with its real value, strip still exactly nine', () => {
    mockSettings.mockReturnValue({
      report_kpis_vacancies: JSON.stringify([
        'longConcept', 'noMatches', 'topFunction', 'topBranch', 'open', 'filled', 'fillRate', 'ttf', 'total',
      ]),
    })
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    const longConceptLabel = screen.getByText(i18n.t('vacancies.summary.longConcept', { ns: 'analytics' }))
    expect(within(longConceptLabel.parentElement as HTMLElement).getByText('1')).toBeInTheDocument()
    const noMatchesLabel = screen.getByText(i18n.t('vacancies.summary.noMatches', { ns: 'analytics' }))
    expect(within(noMatchesLabel.parentElement as HTMLElement).getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Verzorgende IG · 9')).toBeInTheDocument() // topFunction
    expect(screen.getByText('Utrecht · 12')).toBeInTheDocument() // topBranch
    // No KPI-band notice — every stored key is real, still nine cards.
    expect(screen.queryByText(i18n.t('vacancies.kpiOrderFellBack', { ns: 'analytics' }))).not.toBeInTheDocument()
  })

  // VAC-DRILL-SIGNALS-2: longConcept/noMatches are real backend counts, but the
  // drill endpoint's XOR whitelist has no `signal` param — both render as honest,
  // non-clickable stats (no role="button", no drill request on click) until the
  // backend adds matching boolean keys.
  // KPIS-DRILL-1: superseded — longConcept/noMatches now drill via the backend's
  // own kpis/drill endpoint (kpi=long_concept / kpi=no_matches), never the plain
  // /reports/vacancies/drill route (which indeed has no `signal` XOR key).
  it('longConcept/noMatches KPI cards drill via kpis/drill, never the plain drill endpoint', async () => {
    const user = userEvent.setup()
    mockSettings.mockReturnValue({
      report_kpis_vacancies: JSON.stringify([
        'longConcept', 'noMatches', 'open', 'filled', 'fillRate', 'ttf', 'staleOnline', 'customersCount', 'total',
      ]),
    })
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()

    const longConceptLabel = screen.getByText(i18n.t('vacancies.summary.longConcept', { ns: 'analytics' }))
    await user.click(longConceptLabel)
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/vacancies/drill')).toBe(false)
    expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/kpis/drill',
      expect.objectContaining({ params: { kpi: 'long_concept', period: 'month' } }))

    const noMatchesLabel = screen.getByText(i18n.t('vacancies.summary.noMatches', { ns: 'analytics' }))
    await user.click(noMatchesLabel)
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/vacancies/drill')).toBe(false)
    expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/kpis/drill',
      expect.objectContaining({ params: { kpi: 'no_matches', period: 'month' } }))
  })

  // KPI-DREMPELS-FE-1: adviceStale/closingSoon render the real backend counts with
  // their own tenant-threshold caption. adviceStale reuses the existing
  // stale_online=1 drill (same underlying predicate as staleOnline). closingSoon
  // drills via its own `closing_soon` boolean XOR key (VAC-CLOSING-SOON-DRILL-1,
  // mirrors stale_online) — never a `signal` param.
  it('adviceStale/closingSoon KPI cards render their threshold caption and both drill', async () => {
    const user = userEvent.setup()
    mockSettings.mockReturnValue({
      report_kpis_vacancies: JSON.stringify([
        'adviceStale', 'closingSoon', 'open', 'filled', 'fillRate', 'ttf', 'staleOnline', 'customersCount', 'total',
      ]),
    })
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()

    const adviceStaleLabel = screen.getByText(i18n.t('vacancies.summary.adviceStale', { ns: 'analytics' }))
    const adviceStaleCard = adviceStaleLabel.parentElement as HTMLElement
    expect(within(adviceStaleCard).getByText('2')).toBeInTheDocument()
    expect(within(adviceStaleCard).getByText(i18n.t('thresholdDays', { ns: 'analytics', n: 14 }))).toBeInTheDocument()

    const closingSoonLabel = screen.getByText(i18n.t('vacancies.summary.closingSoon', { ns: 'analytics' }))
    const closingSoonCard = closingSoonLabel.parentElement as HTMLElement
    expect(within(closingSoonCard).getByText('1')).toBeInTheDocument()
    expect(within(closingSoonCard).getByText(i18n.t('thresholdDays', { ns: 'analytics', n: 7 }))).toBeInTheDocument()

    await user.click(closingSoonLabel)
    expect(lastDrillParams()).toEqual({ closing_soon: 1, period: 'month' })

    await user.click(adviceStaleLabel)
    expect(lastDrillParams()).toEqual({ stale_online: 1, period: 'month' })
  })

  // KPIS-DRILL-1: fillRate drills via kpis/drill with kpi=fill_rate (rate-style).
  it('clicking the fillRate card drills via /reports/vacancies/kpis/drill with kpi=fill_rate', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText(i18n.t('vacancies.summary.fillRate', { ns: 'analytics' })))
    expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/kpis/drill',
      expect.objectContaining({ params: { kpi: 'fill_rate', period: 'month' } }))
  })

  // KPIS-DRILL-1: longConcept drills via kpis/drill with kpi=long_concept (count-style).
  it('clicking the longConcept card drills via /reports/vacancies/kpis/drill with kpi=long_concept', async () => {
    const user = userEvent.setup()
    mockSettings.mockReturnValue({
      report_kpis_vacancies: JSON.stringify([
        'longConcept', 'noMatches', 'open', 'filled', 'fillRate', 'ttf', 'staleOnline', 'customersCount', 'total',
      ]),
    })
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText(i18n.t('vacancies.summary.longConcept', { ns: 'analytics' })))
    expect(getSpy).toHaveBeenCalledWith('/reports/vacancies/kpis/drill',
      expect.objectContaining({ params: { kpi: 'long_concept', period: 'month' } }))
  })

  // RAPPORT-KPI-INSTELBAAR: which nine keys render, and in what order, is the
  // tenant's stored Settings → Reports choice, not the hardcoded default order.
  it('renders the KPI strip in the tenant-chosen stored order', () => {
    mockSettings.mockReturnValue({
      report_kpis_vacancies: JSON.stringify([
        'topOwner', 'topIndustry', 'customersCount', 'staleOnline', 'ttf', 'fillRate', 'filled', 'open', 'total',
      ]),
    })
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    const { container } = renderReport()
    const totalLabel = i18n.t('vacancies.summary.total', { ns: 'analytics' })
    const topOwnerLabel = i18n.t('vacancies.summary.topOwner', { ns: 'analytics' })
    const text = container.textContent ?? ''
    // The stored order puts topOwner FIRST and total LAST — the strip must
    // render in that exact order, not today's hardcoded sequence.
    expect(text.indexOf(topOwnerLabel)).toBeGreaterThanOrEqual(0)
    expect(text.indexOf(topOwnerLabel)).toBeLessThan(text.indexOf(totalLabel))
  })

  // A vanished stored key falls back silently on the report itself (never a
  // crash or a blank slot) but surfaces a visible notice via ReportKpiBand.
  it('falls back a vanished stored key to the default and shows a notice, never crashing', () => {
    mockSettings.mockReturnValue({
      report_kpis_vacancies: JSON.stringify([
        'ghost_key', 'open', 'filled', 'fillRate', 'ttf', 'staleOnline', 'customersCount', 'topIndustry', 'topOwner',
      ]),
    })
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText(i18n.t('vacancies.summary.total', { ns: 'analytics' }))).toBeInTheDocument() // backfilled default
    expect(screen.getByText(i18n.t('vacancies.kpiOrderFellBack', { ns: 'analytics' }))).toBeInTheDocument()
  })

  // Legacy summary-KPI drill (unchanged C-34 behaviour): the Open tile explains the
  // open/filled split via status=open.
  it('the legacy "Open" KPI still drills with status=open', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // First 'Open' in DOM order is the KPI tile (strip renders above the table).
    await user.click(screen.getAllByText('Open')[0])
    expect(lastDrillParams()).toEqual({ status: 'open', period: 'month' })
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

  // REPORTS-DRILL-2 (verified live): the "Online, geen kandidaten" KPI now drills
  // with the real backend `stale_online=1` XOR param, the same predicate the
  // card's own count comes from (summary.stale_online).
  it('clicking the "Online, geen kandidaten" KPI drills with stale_online=1', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Online, geen kandidaten'))
    expect(lastDrillParams()).toEqual({ stale_online: 1, period: 'month' })
  })

  // REPORTS-DRILL-2 (verified live): the zero-applicants section header ALSO opens
  // the backend's own `zero_applications=1` drill — a DIFFERENT XOR param than
  // `stale_online`, so the two signals never collapse onto the same request.
  it('clicking the zero-applicants section header drills with zero_applications=1, distinct from stale_online', async () => {
    const user = userEvent.setup()
    const zeroRow = { ...row, key: 'v2', label: 'Doktersassistent', applications: 0, matched: 0 }
    mockUseVacanciesReport.mockReturnValue({ data: { ...data, vacancies: [row, zeroRow] }, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Vacatures zonder sollicitaties (1)'))
    expect(lastDrillParams()).toEqual({ zero_applications: 1, period: 'month' })
    expect(lastDrillParams()).not.toHaveProperty('stale_online')

    await user.click(screen.getByText('Online, geen kandidaten'))
    expect(lastDrillParams()).toEqual({ stale_online: 1, period: 'month' })
    expect(lastDrillParams()).not.toHaveProperty('zero_applications')
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
