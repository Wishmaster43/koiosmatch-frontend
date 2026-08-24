import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ApplicationsReport from './ApplicationsReport'
import type { ApplicationsReportData } from '@/types/analytics'
import { getReportKpiCatalog } from './kpiCatalog'

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

// Tenant KPI-order settings (RAPPORT-KPI-INSTELBAAR) — empty blob = today's
// default order, unless a test overrides it.
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

const data: ApplicationsReportData = {
  period: 'month', from: '2026-08-01', to: '2026-08-31', total: 20,
  timeseries: { bucket: 'week', series: [{ date: '2026-08-03', label: 'Wk 32', value: 8 }, { date: '2026-08-10', label: 'Wk 33', value: 12 }] },
  by_bucket: { active: 10, matched: 4, rejected: 3, placed: 3 },
  by_stage: [
    // eslint-disable-next-line no-restricted-syntax -- DATA: server lookup colour in a test fixture, not UI styling
    { value: 'applied', label: 'Applied', color: '#16a34a', count: 10 },
    { value: 'none', label: 'Geen fase', color: null, count: 2 },
  ],
  by_source: [{ value: 'referral', label: 'Referral', color: null, count: 6 }],
  by_owner: [
    { owner_id: 'u1', name: 'Anna de Vries', count: 12 },
    { owner_id: 'none', name: 'Niet toegewezen', count: 8 },
  ],
  by_customer: [
    { value: 'c1', label: 'Yesway Flex', count: 15 },
    { value: 'none', label: 'Geen klant', count: 3 },
    { value: 'others', label: 'Overig', count: 2 },
  ],
  by_vacancy: [
    { value: 'v1', label: 'Verpleegkundige (gearchiveerd)', count: 9 },
    { value: 'others', label: 'Overig', count: 1 },
  ],
  by_stage_duration: [
    { value: 'applied', label: 'Applied (duration)', count: 5, avg_days_in_phase: 12.5 },
    { value: 'intake', label: 'Intake (duration)', count: 3, avg_days_in_phase: 4 },
  ],
  // RAPPORT-APPS-VERDIEPING-1: the nine server-card envelope, ignored server
  // `label` (§5 — labels come from i18n, mirrors WhatsappReportData fixture).
  kpis: [
    { key: 'total', label: 'ignored', count: 20 },
    { key: 'new', label: 'ignored', count: 5 },
    { key: 'active', label: 'ignored', count: 10 },
    { key: 'matched', label: 'ignored', count: 4 },
    { key: 'rejected', label: 'ignored', count: 3 },
    { key: 'conversion_pct', label: 'ignored', count: 20 },
    { key: 'avg_days_to_match', label: 'ignored', count: 6 },
    { key: 'too_long_in_stage', label: 'ignored', count: 2 },
    { key: 'missing_appointment', label: 'ignored', count: 1 },
  ],
  intakes: {
    planned: 13, done_in_period: 11,
    by_recruiter: [{ owner_id: 'u2', name: 'Bram Smit', count: 3 }],
    by_branch: [{ value: 'b1', label: 'Amsterdam', count: 4 }],
  },
}

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
    const filters = { status: ['active'], ownerId: ['u1'], locationId: [7], customerId: ['c1'] }
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

  // INTAKE-IN-APPS-1: the new intake block — two tiles + two non-clickable
  // distribution axes, straight off the envelope's `intakes` field.
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

  // No fake affordance (§3): the intake block never fires a request — there is
  // no backend intake-drill endpoint to click through to.
  it('never fires a request when clicking inside the intake block', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('Amsterdam'))
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

  // RAPPORT-APPS-VERDIEPING-1: 'applications' is now a 'fixed' family scope
  // (like whatsapp) — the catalogue is exactly the nine server keys, no spares.
  it('the applications KPI catalogue is exactly the nine fixed server keys', () => {
    const keys = getReportKpiCatalog('applications').map(c => c.key)
    expect(keys).toEqual(['total', 'new', 'active', 'matched', 'rejected', 'conversionPct',
      'avgDaysToMatch', 'tooLongInStage', 'missingAppointment'])
  })

  // REPORTGRID-1 item 4: applications has a real backend compare slug
  // (reportCompareSupport.ts), so the shared ReportCompareControl renders.
  it('renders the ReportCompareControl (backend-registered compare slug)', () => {
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Vergelijk met')).toBeInTheDocument()
  })
})
