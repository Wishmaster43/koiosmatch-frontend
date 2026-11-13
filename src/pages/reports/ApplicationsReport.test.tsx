import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ApplicationsReport from './ApplicationsReport'
import i18n from '@/i18n'
import { getReportKpiCatalog } from './kpiCatalog'
import { EMPTY_REPORT_FILTERS } from './reportFilterParams'
import { data } from './ApplicationsReport.testKit'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseApplicationsReport = vi.fn()
vi.mock('./useApplicationsReport', () => ({ useApplicationsReport: (...args: unknown[]) => mockUseApplicationsReport(...args) }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/body) that a bar/bucket click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// Mock useReportKpiSelection hook to return default KPI order
const mockUseReportKpiSelection = vi.fn(() => ({ data: ['total_applications', 'active_applications', 'matched_applications', 'rejected_applications', 'placed_applications', 'by_stage', 'by_function', 'by_candidate_phase', 'by_owner'] as string[], isLoading: false }))
vi.mock('./hooks/useReportKpiSelection', () => ({ useReportKpiSelection: () => mockUseReportKpiSelection() }))

// Tenant KPI-order settings (RAPPORT-KPI-INSTELBAAR) — empty blob = today's
// default order, unless a test overrides it.
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <ApplicationsReport period="month" />
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

// RAPPORT-GEZICHT-WAVE2: the Recharts house charts need real layout (jsdom has
// none) — stubs expose the exact click contract the real components deliver
// (donut: the datum incl. `key`; bar: the original ChartDatum). Mirrors
// CandidatesReport.test.tsx exactly.
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

describe('ApplicationsReport (RAPPORTEN-SUITE-1 portie 2)', () => {
  // Every section now defaults its own list on mount, firing extra drill/advice
  // requests — clear the shared spy between tests so a later assertion never
  // matches a PRIOR test's leftover call history.
  afterEach(() => { getSpy.mockClear() })

  it('shows the loading state', () => {
    mockUseApplicationsReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Sollicitaties laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseApplicationsReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de sollicitaties niet laden')).toBeInTheDocument()
  })

  // The shared ReportStateBlock retry button must call the hook's own refetch,
  // never a page-local reload — same affordance on every report (§13).
  it('retries via the hook refetch when the retry button is clicked', async () => {
    const refetch = vi.fn()
    mockUseApplicationsReport.mockReturnValue({ data: null, loading: false, error: true, refetch })
    renderReport()
    await userEvent.click(screen.getByRole('button', { name: 'Probeer opnieuw' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state when there are no applications', () => {
    mockUseApplicationsReport.mockReturnValue({
      data: { ...data, total: 0, by_stage: [], by_source: [], by_owner: [], by_customer: [], by_vacancy: [],
        by_bucket: { active: 0, matched: 0, rejected: 0, placed: 0 }, timeseries: { bucket: 'week', series: [] },
        kpis: [], intakes: { planned: 0, done_in_period: 0, by_recruiter: [], by_branch: [] } },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen sollicitaties in deze periode')).toBeInTheDocument()
  })

  it('renders the axis bars on success, including the sentinel rows', () => {
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Applied')).toBeInTheDocument()
    expect(screen.getByText('Geen fase')).toBeInTheDocument()
    expect(screen.getByText('Anna de Vries')).toBeInTheDocument()
    expect(screen.getByText('Niet toegewezen')).toBeInTheDocument()
    expect(screen.getByText('Yesway Flex')).toBeInTheDocument()
    expect(screen.getByText('Geen klant')).toBeInTheDocument()
    // Two 'others' bars (customer + vacancy) both render with their real label.
    expect(screen.getAllByText('Overig')).toHaveLength(2)
    // An archived vacancy still carries its real title.
    expect(screen.getByText('Verpleegkundige (gearchiveerd)')).toBeInTheDocument()
  })

  // BELANGRIJK per contract: the created_at window must be prominent, DD-MM-YYYY —
  // never ISO (CLAUDE.md §3B DATUM-1).
  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Sollicitaties 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  // RAPPORT-FILTERS-2: the panel's active filters reach BOTH the report hook and
  // a drill click — bar and lade can never disagree (mirrors CandidatesReport).
  it('sends the active panel filters to BOTH the report hook and a drill click', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    const filters = { ...EMPTY_REPORT_FILTERS, status: ['active'], ownerId: ['u1'], locationId: [7], customerId: ['c1'] }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ApplicationsReport period="month" filters={filters} />
      </QueryClientProvider>,
    )
    expect(mockUseApplicationsReport).toHaveBeenCalledWith('month', filters)
    await user.click(screen.getByText('Applied'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill', expect.objectContaining({
      params: { period: 'month', status: ['active'], owner_id: ['u1'], location_id: [7], customer_id: ['c1'], stage: 'applied' },
    }))
  })

  it('clicking a stage bar drills with the stage XOR param, never mixed with other axes', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Applied'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { stage: 'applied', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/advice',
      expect.objectContaining({ params: { stage: 'applied', period: 'month' } }))
  })

  // REPORT-FUNNEL-DIRECT-1 (BE 862508c3): the per-stage direct-entries caption —
  // rendered ONLY when > 0 (teller-canon: a zero renders nothing, and an older
  // BE without the field renders nothing either).
  it('shows "waarvan {n} direct ingestroomd" per stage only when direct_entries > 0', async () => {
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    const caption = i18n.t('applications.axes.directEntries', { ns: 'analytics', count: 4 })
    expect(screen.getByText(caption)).toBeInTheDocument()
    const zeroCaption = i18n.t('applications.axes.directEntries', { ns: 'analytics', count: 0 })
    expect(screen.queryByText(zeroCaption)).toBeNull()
  })

  // Sentinel drawer: stage='none' opens exactly like any other stage row.
  it('clicking the "Geen fase" sentinel row drills with stage=none', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Geen fase'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { stage: 'none', period: 'month' } }))
  })

  // REPORTS-DRILL-2: stage_duration is its OWN param, never mixed with `stage`
  // even though both axes share the same stage-key vocabulary.
  it('clicking a stage-duration bar drills with stage_duration, never stage', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Intake (duration)'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { stage_duration: 'intake', period: 'month' } }))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/applications/drill'
      && (c[1] as { params: Record<string, unknown> }).params.stage_duration === 'intake')
    expect(call?.[1].params).not.toHaveProperty('stage')
  })

  it('clicking an owner bar drills with the owner XOR param (D2 shape: owner_id → owner)', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Anna de Vries'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { owner: 'u1', period: 'month' } }))
  })

  // Sentinel drawer: owner='none' (unassigned) is a real, clickable row.
  it('clicking the "Niet toegewezen" owner row drills with owner=none', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Niet toegewezen'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { owner: 'none', period: 'month' } }))
  })

  it('clicking the customer "Overig" bar drills with customer=others', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    const [customerOthers] = screen.getAllByText('Overig')
    await user.click(customerOthers)
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { customer: 'others', period: 'month' } }))
  })

  it('clicking the customer "Geen klant" bar drills with customer=none', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Geen klant'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { customer: 'none', period: 'month' } }))
  })

  it('an archived vacancy row keeps its real title and drills with vacancy=<id>', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Verpleegkundige (gearchiveerd)'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { vacancy: 'v1', period: 'month' } }))
  })

  // FUNNEL role of `bucket`: a bucket bar drills with `bucket=<funnel value>`
  // WITHOUT a `date` param — the segment role, distinct from the granularity role
  // exercised in the two tests below.
  it('clicking a funnel bucket bar drills with bucket=<value> and no date', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Geplaatst'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { bucket: 'placed', period: 'month' } }))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/applications/drill' &&
      (c[1] as { params: Record<string, unknown> }).params.bucket === 'placed')
    expect(call?.[1].params).not.toHaveProperty('date')
  })

  // GRANULARITY role of `bucket`: a week timeseries bar drills with date=<key> +
  // bucket=week — the drawer then counts the WHOLE week so bar and drawer totals
  // always agree. The two roles' values (funnel vs day|week) never overlap.
  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 32'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { date: '2026-08-03', bucket: 'week', period: 'month' } }))
  })

  // RAPPORT-APPS-VERDIEPING-1: the nine-card strip now reads straight off the
  // envelope's own `kpis[]` — real counts from the fixture, local i18n labels.
  it('renders the nine envelope KPI cards with real counts, server label ignored', () => {
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    const cardLabels = ['Totaal sollicitaties', 'Nieuw', 'Actief', 'Gematcht', 'Afgewezen', 'Conversie',
      'Gem. dagen tot match', 'Te lang in fase', 'Afspraak ontbreekt']
    expect(cardLabels).toHaveLength(9)
    for (const label of cardLabels) expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    for (const count of [20, 5, 10, 4, 3, 6]) expect(screen.getAllByText(String(count)).length).toBeGreaterThan(0)
    expect(screen.queryByText('ignored')).not.toBeInTheDocument()
  })

  // The ONE per-KPI drill: kpi=<key>, layered on the report's own baseParams
  // (whatsapp pattern, §13 — assert the request, never only that it fired).
  it('clicking a KPI card drills via /reports/applications/kpis/drill with kpi=<key>', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Totaal sollicitaties'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/kpis/drill',
      expect.objectContaining({ params: { kpi: 'total', period: 'month' } }))
  })

  it('clicking the "too long in stage" KPI card drills with kpi=too_long_in_stage', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // Two DOM matches for the label (the KPI card + the axis section heading
    // below it) — the KPI strip renders first, so index 0 is the clickable card.
    await user.click(screen.getAllByText('Te lang in fase')[0])
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/kpis/drill',
      expect.objectContaining({ params: { kpi: 'too_long_in_stage', period: 'month' } }))
  })

  // INTAKE-IN-APPS-1: the intake block — two display-only tiles + two clickable
  // distribution axes (see the intakes/drill tests below), straight off the
  // envelope's `intakes` field.
  it('renders the intake block from the fixture', () => {
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Gepland')).toBeInTheDocument()
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText('Afgerond in periode')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('Per recruiter')).toBeInTheDocument()
    expect(screen.getByText('Bram Smit')).toBeInTheDocument()
    expect(screen.getByText('Per vestiging')).toBeInTheDocument()
    expect(screen.getByText('Amsterdam')).toBeInTheDocument()
  })

  // INTAKE-IN-APPS-1: the by_recruiter bar drills via the new intakes/drill
  // endpoint (operation getReportsApplicationsIntakesDrill), axis=recruiter,
  // value=owner_id — never the displayed name.
  it('clicking a by-recruiter intake bar drills via /reports/applications/intakes/drill with axis=recruiter', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('Bram Smit'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/intakes/drill',
      expect.objectContaining({ params: { axis: 'recruiter', value: 'u2', period: 'month' } }))
  })

  // Same endpoint, axis=branch — value is the segment's own `value` field, never
  // the rendered branch label.
  it('clicking a by-branch intake bar drills via /reports/applications/intakes/drill with axis=branch', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('Amsterdam'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/intakes/drill',
      expect.objectContaining({ params: { axis: 'branch', value: 'b1', period: 'month' } }))
  })

  // The planned tile now drills via the same intakes/drill endpoint, axis=state,
  // value='planned' (confirmed vocabulary, api-generated.ts query.value doc).
  it('clicking the planned intake tile drills via /reports/applications/intakes/drill with axis=state value=planned', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('Gepland'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/intakes/drill',
      expect.objectContaining({ params: { axis: 'state', value: 'planned', period: 'month' } }))
  })

  // Same tile family, done-in-period → value='done'.
  it('clicking the done intake tile drills via /reports/applications/intakes/drill with axis=state value=done', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('Afgerond in periode'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/intakes/drill',
      expect.objectContaining({ params: { axis: 'state', value: 'done', period: 'month' } }))
  })

  // With a panel filter active, intake tiles/bars stay non-drillable (same gate
  // as recruiter/branch — the intakes endpoint has no filter params, so a filtered
  // envelope would disagree with the drawer's unfiltered count).
  it('does not fire a request when clicking the planned tile while a panel filter is active', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ApplicationsReport period="month" filters={{ ...EMPTY_REPORT_FILTERS, status: ['active'] }} />
      </QueryClientProvider>,
    )
    getSpy.mockClear()
    await user.click(screen.getByText('Gepland'))
    expect(getSpy).not.toHaveBeenCalled()
  })

  it('omits bucket when the timeseries is day-granular', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({
      data: { ...data, timeseries: { bucket: 'day', series: [{ date: '2026-08-03', label: '03-08', value: 2 }] } },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('03-08'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { date: '2026-08-03', period: 'month' } }))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/applications/drill')
    expect(call?.[1].params).not.toHaveProperty('bucket')
  })

  // REPORTGRID-1: the shared drill drawer opens only on click, never
  // auto-defaulted on mount.
  it('never fires a drill request before any segment is clicked', () => {
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(getSpy).not.toHaveBeenCalled()
  })

  // Clicking a segment in a different chart REPLACES the shared drawer's
  // content — one drawer for the whole page, not one list per section.
  it('clicking a segment in a different chart replaces the shared drawer', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Geen klant'))
    getSpy.mockClear()
    await user.click(screen.getByText('Applied'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { stage: 'applied', period: 'month' } }))
  })

  // RAPPORT-APPS-VERDIEPING-1 + REPORT-KPI-CARDS-MISSING-1: the catalogue is the nine fixed
  // server keys (snake_case) plus stage_dwell, the tenth key, appended last.
  it('the applications KPI catalogue is the nine fixed server keys plus stage_dwell appended last', () => {
    const keys = getReportKpiCatalog('applications').map(c => c.key)
    expect(keys).toEqual(['total', 'new', 'active', 'matched', 'rejected', 'conversion_pct',
      'avg_days_to_match', 'too_long_in_stage', 'missing_appointment', 'stage_dwell'])
  })

  // REPORT-KPI-CARDS-MISSING-1: a stored selection with stage_dwell renders its card (workdays
  // formatted in nl, caption from i18n), does not fall back, and the card drills like
  // its siblings (REPORT-KPI-DRILL-KEYS-1: the BE accepts kpi=stage_dwell).
  it('renders the stage_dwell card in workdays and drills with kpi=stage_dwell', async () => {
    const user = userEvent.setup()
    mockUseReportKpiSelection.mockReturnValue({ data: ['stage_dwell', 'total'], isLoading: false })
    mockUseApplicationsReport.mockReturnValue({
      data: { ...data, kpis: [...(data.kpis ?? []), { key: 'stage_dwell', label: 'ignored', count: 7.5 }] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText(i18n.t('applications.kpi.stageDwell', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getByText('7,5')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('applications.kpi.workdaysUnit', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t('applications.kpiOrderFellBack', { ns: 'analytics' }))).not.toBeInTheDocument()
    getSpy.mockClear()
    await user.click(screen.getByText('7,5'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/kpis/drill',
      expect.objectContaining({ params: { kpi: 'stage_dwell', period: 'month' } }))
    expect(screen.getByRole('button', { name: (n: string) => n.includes(i18n.t('applications.kpi.stageDwell', { ns: 'analytics' })) })).toBeInTheDocument()
    mockUseReportKpiSelection.mockReset()
  })

  // REPORT-KPI-DRILL-KEYS-1 (BE 254ba4200): the stage_dwell drill layers the panel
  // filters on top of its kpi key like every sibling card (one shared baseParams).
  it('the stage_dwell drill carries the active panel filters next to its kpi key', async () => {
    const user = userEvent.setup()
    mockUseReportKpiSelection.mockReturnValue({ data: ['stage_dwell', 'total'], isLoading: false })
    mockUseApplicationsReport.mockReturnValue({
      data: { ...data, kpis: [...(data.kpis ?? []), { key: 'stage_dwell', label: 'ignored', count: 7.5 }] },
      loading: false, error: false,
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ApplicationsReport period="month" filters={{ ...EMPTY_REPORT_FILTERS, status: ['active'], ownerId: ['u1'] }} />
      </QueryClientProvider>,
    )
    getSpy.mockClear()
    await user.click(screen.getByText('7,5'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/kpis/drill',
      expect.objectContaining({ params: expect.objectContaining({ kpi: 'stage_dwell', period: 'month', status: ['active'], owner_id: ['u1'] }) }))
    mockUseReportKpiSelection.mockReset()
  })

  // RAPPORT-COMPARE-2 (§4): the compare window lives in the right-hand filter
  // panel (ReportsPage) — the page itself renders NO inline compare control.
  it('renders no inline compare control (moved to the right filter panel)', () => {
    expect(screen.queryByText('Vergelijk met')).not.toBeInTheDocument()
  })
})
