import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ApplicationsReport from './ApplicationsReport'
import type { ApplicationsReportData } from '@/types/analytics'

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
        by_bucket: { active: 0, matched: 0, rejected: 0, placed: 0 }, timeseries: { bucket: 'week', series: [] } },
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

  // Nine-card KPI strip: total + the four fixed funnel-bucket counts + the top
  // segment of four more axes, all real counts from the fixture's own axes.
  it('renders nine KPI cards: total + funnel buckets + top axis segments', () => {
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal sollicitaties')).toBeInTheDocument()
    expect(screen.getByText('Funnel: Geplaatst')).toBeInTheDocument()
    expect(screen.getByText('Fase: Applied')).toBeInTheDocument()
    expect(screen.getByText('Klant: Yesway Flex')).toBeInTheDocument()
  })

  it('clicking a funnel-bucket KPI card drills with the same bucket XOR param as its bar', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Funnel: Geplaatst'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { bucket: 'placed', period: 'month' } }))
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

  // RAPPORTEN-DRILLLIST-1: every axis section shows its own always-visible list
  // beside the chart, seeded with a real request on mount — never a blank panel.
  it('renders a drill list beside each axis chart, defaulted on mount', () => {
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // The stage axis's top segment (Applied, 10) seeds its own list on mount.
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { stage: 'applied', period: 'month' } }))
    // The customer axis independently seeds its own list with its own top segment.
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { customer: 'c1', period: 'month' } }))
    // The funnel-bucket section seeds its own list with its own top segment.
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { bucket: 'active', period: 'month' } }))
  })

  // Clicking a segment in ONE chart never changes another chart's list — each
  // section keeps its own independent drill state.
  it('clicking a segment in one chart never changes another chart\'s list', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    // "Geen klant" is not the top customer segment (Yesway Flex is), so it is
    // guaranteed to differ from the mount default and fire a fresh request.
    await user.click(screen.getByText('Geen klant'))
    expect(getSpy).toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: { customer: 'none', period: 'month' } }))
    // The stage section was never re-fetched by the customer click.
    expect(getSpy).not.toHaveBeenCalledWith('/reports/applications/drill',
      expect.objectContaining({ params: expect.objectContaining({ stage: expect.anything() }) }))
  })
})
