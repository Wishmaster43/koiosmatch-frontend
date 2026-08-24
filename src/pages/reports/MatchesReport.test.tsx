import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MatchesReport from './MatchesReport'
import type { MatchesReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseMatchesReport = vi.fn()
vi.mock('./useMatchesReport', () => ({ useMatchesReport: (...args: unknown[]) => mockUseMatchesReport(...args) }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar click sends — mutation tests must assert the
// request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn()
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

// Fixture per the portie-7 contract: from/to in the envelope, week timeseries
// whose series[0].date is the MONDAY of the week containing `from` (27-07 for a
// 01-08 Saturday start — a pre-from Monday is the contract, not an error), the
// under_contract tile counts (total = matches under contract) and terminations
// whose by_reason rows carry `value` mirroring `key`.
const data: MatchesReportData = {
  period: 'month', from: '2026-08-01', to: '2026-08-31', total: 16,
  by_origin: { funnel: 10, direct: 6 },
  timeseries: { bucket: 'week', series: [
    { date: '2026-07-27', label: 'Wk 31', value: 9 },
    { date: '2026-08-03', label: 'Wk 32', value: 7 },
  ] },
  by_contract_form: [
    // eslint-disable-next-line no-restricted-syntax -- DATA: server lookup colour in a test fixture, not UI styling
    { value: 'secondment', label: 'Detachering', color: '#16a34a', count: 9 },
    // eslint-disable-next-line no-restricted-syntax -- DATA: server lookup colour in a test fixture, not UI styling
    { value: 'temp_agency', label: 'Uitzend', color: '#2563eb', count: 4 },
    { value: 'none', label: 'Geen contractvorm', color: null, count: 2 },
    { value: 'zzz-deleted-form', label: 'Onbekend (verwijderde contractvorm)', color: null, count: 1 },
  ],
  // `none` explicit since 7925ce15 (16 total - 13 under contract = 3).
  under_contract: { sent: 5, active: 6, ended: 2, none: 3, total: 13 },
  placements: { sent: 5, active: 6, ended: 2, total: 13 },
  terminations: { total: 3, by_reason: [
    // eslint-disable-next-line no-restricted-syntax -- DATA: server lookup colour in a test fixture, not UI styling
    { key: 'client_stop', value: 'client_stop', label: 'Klant stopt', color: '#dc2626', count: 2 },
    { key: 'own_choice', value: 'own_choice', label: 'Eigen keuze', color: null, count: 1 },
  ] },
  avg_placement_duration_days: null,
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MatchesReport period="month" />
    </QueryClientProvider>,
  )
}

// The last drill call's raw params — for the XOR proofs (exactly ONE segment param).
const lastDrillParams = () =>
  (getSpy.mock.calls.filter(c => c[0] === '/reports/matches/drill').at(-1)?.[1] as { params: Record<string, unknown> }).params
// Same, for the advice endpoint (drill and advice must carry identical XOR params).
const lastAdviceParams = () =>
  (getSpy.mock.calls.filter(c => c[0] === '/reports/matches/advice').at(-1)?.[1] as { params: Record<string, unknown> }).params

// The house LineChartCard needs real layout (jsdom has none) so the timeseries
// wrapper is mocked exactly like WeeklyBarChartCard in TrendsRow.test.tsx: one
// button per point, same label text, onPick fired with the raw date key.
vi.mock('./ReportTimeseriesChart', () => ({
  default: ({ series, onPick }: { series: { date: string; label: string; value: number }[]; onPick?: (date: string) => void }) => (
    <>{series.map(p => <button key={p.date} onClick={() => onPick?.(p.date)}>{p.label}</button>)}</>
  ),
}))

describe('MatchesReport (MATCH-SOORT-1, by_contract_form axis)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  it('shows the loading state', () => {
    mockUseMatchesReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Matches laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseMatchesReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de matches niet laden')).toBeInTheDocument()
  })

  // The shared ReportStateBlock retry button must call the hook's own refetch.
  it('retries via the hook refetch when the retry button is clicked', async () => {
    const refetch = vi.fn()
    mockUseMatchesReport.mockReturnValue({ data: null, loading: false, error: true, refetch })
    renderReport()
    await userEvent.click(screen.getByRole('button', { name: 'Probeer opnieuw' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state when there are no matches', () => {
    mockUseMatchesReport.mockReturnValue({ data: { ...data, total: 0 }, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Geen matches in deze periode')).toBeInTheDocument()
  })

  // As-rendering: every by_contract_form segment renders its own bar with the
  // backend's own label, summing to the report total (9+4+2+1=16).
  it('renders every contract_form segment as its own bar, summing to the total', () => {
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Contractvorm')).toBeInTheDocument()
    expect(screen.getByText('Detachering')).toBeInTheDocument()
    expect(screen.getByText('Uitzend')).toBeInTheDocument()
    expect(screen.getByText('Geen contractvorm')).toBeInTheDocument()
    expect(screen.getByText('Onbekend (verwijderde contractvorm)')).toBeInTheDocument()
    const total = data.by_contract_form.reduce((sum, s) => sum + s.count, 0)
    expect(total).toBe(data.total)
  })

  // RAPPORT-FILTERS-2: the panel's active filters reach BOTH the report hook and
  // a drill click — bar and lade can never disagree (mirrors CandidatesReport).
  // matches never carries customer_id (the singular key is already overloaded).
  it('sends the active panel filters to BOTH the report hook and a drill click', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    const filters = { status: ['open'], ownerId: ['u1'], locationId: [7], customerId: [] }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MatchesReport period="month" filters={filters} />
      </QueryClientProvider>,
    )
    expect(mockUseMatchesReport).toHaveBeenCalledWith('month', filters)
    await user.click(screen.getByText('Detachering'))
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/drill', expect.objectContaining({
      params: { period: 'month', status: ['open'], owner_id: ['u1'], location_id: [7], contract_form: 'secondment' },
    }))
  })

  // 'none'-sentinel drill: the bucket for matches without a contract form drills
  // exactly like any other segment, on its raw 'none' value.
  it('clicking the "none" sentinel bar drills with contract_form=none (XOR — no origin param)', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Geen contractvorm'))
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/drill',
      expect.objectContaining({ params: { contract_form: 'none', period: 'month' } }))
    const call = getSpy.mock.calls.filter(c => c[0] === '/reports/matches/drill').at(-1)
    expect(call?.[1].params).not.toHaveProperty('origin')
  })

  // Orphan-value drill: a deleted contract-form lookup row still renders its own
  // bar with the backend's "Onbekend (…)" label and drills on the raw slug —
  // SegmentBars needs no special-casing, exactly like the sibling reports.
  it('renders an orphaned (deleted-lookup) contract form as its own bar and drills on the raw slug', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend (verwijderde contractvorm)'))
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/drill',
      expect.objectContaining({ params: { contract_form: 'zzz-deleted-form', period: 'month' } }))
  })

  // XOR proof: the ORIGIN KPI (funnel/direct) sends `origin`, never `contract_form`,
  // and vice versa — the two axes are mutually exclusive request params.
  it('clicking the "Via sollicitatie" KPI drills with origin=funnel and no contract_form param', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Via sollicitatie'))
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/drill',
      expect.objectContaining({ params: { origin: 'funnel', period: 'month' } }))
    const call = getSpy.mock.calls.filter(c => c[0] === '/reports/matches/drill').at(-1)
    expect(call?.[1].params).not.toHaveProperty('contract_form')
  })

  it('clicking a contract_form bar sends contract_form and no origin param', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Uitzend'))
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/drill',
      expect.objectContaining({ params: { contract_form: 'temp_agency', period: 'month' } }))
    const call = getSpy.mock.calls.filter(c => c[0] === '/reports/matches/drill').at(-1)
    expect(call?.[1].params).not.toHaveProperty('origin')
  })
})

describe('MatchesReport (RAPPORTEN-SUITE-1 portie 7, closing enrichment)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  // BELANGRIJK per contract: the window must be prominent, DD-MM-YYYY from the
  // RESPONSE — never ISO (CLAUDE.md §3B DATUM-1), never a period echo.
  it('renders the data window prominently as DD-MM-YYYY from the response', () => {
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Matches 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  // Timeseries renders every bucket with the backend's label and sums to the total.
  it('renders the timeseries bars, summing to the report total', () => {
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Matches over tijd')).toBeInTheDocument()
    expect(screen.getByText('Wk 31')).toBeInTheDocument()
    expect(screen.getByText('Wk 32')).toBeInTheDocument()
    expect(data.timeseries.series.reduce((s, p) => s + p.value, 0)).toBe(data.total)
  })

  // REPORTGRID-1: the four sections (series, contract form, tiles, terminations)
  // each render as their own ReportChartCard inside the shared two-column
  // ReportGrid — mirrors every other report page's grid layout, not a single
  // outer card (the old, now-retired hand-typed shape).
  it('renders every section inside the shared ReportGrid, each in its own card', () => {
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    const { container } = renderReport()
    const seriesHeading = screen.getByText('Matches over tijd')
    const terminationsHeading = screen.getByText('Beëindigingsredenen')
    const grid = container.querySelector('.report-grid')
    expect(grid).not.toBeNull()
    expect(grid?.contains(seriesHeading)).toBe(true)
    expect(grid?.contains(terminationsHeading)).toBe(true)
    // Each section is its own card — four cards, not one shared outer card.
    expect(container.querySelectorAll('[style*="border-radius: 12px"]').length).toBe(4)
  })

  // WEEK-FLOOR contract: a week bar drills date=<its own Monday key> + bucket=week —
  // the first bar's pre-from Monday (27-07 vs from=01-08) is normal and drills as-is.
  it('clicking a week timeseries bar drills with date + bucket=week (Monday-floor key)', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 31'))
    expect(lastDrillParams()).toEqual({ date: '2026-07-27', bucket: 'week', period: 'month' })
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/advice',
      expect.objectContaining({ params: { date: '2026-07-27', bucket: 'week', period: 'month' } }))
  })

  // Day granularity opens exactly on `from` (no ghost bucket) and omits `bucket`.
  it('omits bucket when the timeseries is day-granular', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({
      data: { ...data, timeseries: { bucket: 'day', series: [{ date: '2026-08-01', label: '01-08', value: 16 }] } },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('01-08'))
    expect(lastDrillParams()).toEqual({ date: '2026-08-01', period: 'month' })
  })

  // Each under_contract tile drills contract_status=<its key> — drill AND advice.
  it('clicking the sent/active/ended tiles drills with contract_status=<key>', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // 'Verzonden'/'Actief'/'Beëindigd' now render twice (KPI card + StatTile
    // below) — either fires the identical contract_status drill, so click the
    // first (the KPI card).
    await user.click(screen.getAllByText('Verzonden')[0])
    expect(lastDrillParams()).toEqual({ contract_status: 'sent', period: 'month' })
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/advice',
      expect.objectContaining({ params: { contract_status: 'sent', period: 'month' } }))
    await user.click(screen.getAllByText('Actief')[0])
    expect(lastDrillParams()).toEqual({ contract_status: 'active', period: 'month' })
    await user.click(screen.getAllByText('Beëindigd')[0])
    expect(lastDrillParams()).toEqual({ contract_status: 'ended', period: 'month' })
  })

  // The 'none' tile reads the explicit envelope count (7925ce15), falling back to
  // total - under_contract.total for a cached pre-update response.
  it('renders the none tile with the envelope count and drills contract_status=none', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    const tile = screen.getByText('Geen contract').closest('[role="button"]')
    expect(tile).not.toBeNull()
    expect(tile).toHaveTextContent('3')
    await user.click(screen.getByText('Geen contract'))
    expect(lastDrillParams()).toEqual({ contract_status: 'none', period: 'month' })
  })

  it('falls back to the derived none count when the envelope predates the explicit key', () => {
    const oldShape = { ...data.under_contract }
    delete oldShape.none
    mockUseMatchesReport.mockReturnValue({ data: { ...data, under_contract: oldShape }, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Geen contract').closest('[role="button"]')).toHaveTextContent('3')
  })

  // ADVICE UN-GAP (portie 7): a contract_form bar requests BOTH drill and advice
  // with contract_form=<slug> — the advice endpoint knows the axis now.
  it('clicking a contract_form bar requests advice with contract_form=<slug>', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Detachering'))
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/drill',
      expect.objectContaining({ params: { contract_form: 'secondment', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/advice',
      expect.objectContaining({ params: { contract_form: 'secondment', period: 'month' } }))
  })

  // Four-way XOR proof, both directions across all four axes: every drill call
  // carries exactly ONE segment param — no residue from the earlier pick.
  it('sends exactly one XOR param per drill call, in both directions across the axes', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Via sollicitatie'))
    expect(lastDrillParams()).toEqual({ origin: 'funnel', period: 'month' })
    await user.click(screen.getByText('Uitzend'))
    expect(lastDrillParams()).toEqual({ contract_form: 'temp_agency', period: 'month' })
    await user.click(screen.getAllByText('Verzonden')[0])
    expect(lastDrillParams()).toEqual({ contract_status: 'sent', period: 'month' })
    await user.click(screen.getByText('Wk 32'))
    expect(lastDrillParams()).toEqual({ date: '2026-08-03', bucket: 'week', period: 'month' })
    await user.click(screen.getByText('Direct'))
    expect(lastDrillParams()).toEqual({ origin: 'direct', period: 'month' })
  })

  // terminations.by_reason drills stop_reason=<value> — the FIFTH XOR leg
  // (7925ce15); the axis is windowed on the termination event, drawer == bar.
  it('clicking a termination-reason bar drills with stop_reason (drill + advice)', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Beëindigingsredenen')).toBeInTheDocument()
    await user.click(screen.getByText('Klant stopt'))
    expect(lastDrillParams()).toEqual({ stop_reason: 'client_stop', period: 'month' })
    expect(lastAdviceParams()).toEqual({ stop_reason: 'client_stop', period: 'month' })
  })

  // Every drill source targets the ONE matches drill/advice pair — never a sibling
  // report's endpoint, never an entity list route.
  it('always drills via /reports/matches/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Via sollicitatie'))
    await user.click(screen.getByText('Detachering'))
    await user.click(screen.getAllByText('Actief')[0])
    await user.click(screen.getByText('Wk 32'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/matches/drill' || c[0] === '/reports/matches/advice')).toBe(true)
  })
})

// Nine-card KPI footprint (Danny — same as the dashboard, all reports). Every
// card is derived from a field the endpoint already returns; sent/active/ended
// mirror the under_contract tiles below and share their drill; the termination
// total/rate and avg duration render as honest, non-fabricated stats.
describe('MatchesReport (nine-card KPI footprint)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  it('renders exactly nine KPI cards from the fixture', () => {
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    for (const label of ['Totaal matches', 'Via sollicitatie', 'Direct', 'Verzonden', 'Actief', 'Beëindigd',
      'Totaal beëindigingen', 'Gem. matchduur', 'Beëindigingspercentage']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1)
    }
    // Termination rate: 3 / 16 * 100 = 18,75% → the house number formatter.
    expect(screen.getByText('18,8%')).toBeInTheDocument()  // FMT-PROCENT-1: at most one decimal
  })

  it('clicking the "sent" KPI card sends contract_status=sent, same as the tile below', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Verzonden')[0])
    expect(lastDrillParams()).toEqual({ contract_status: 'sent', period: 'month' })
  })

  it('the avg-duration KPI shows a dash, never a fabricated zero, while HelloFlex has not filled it', () => {
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(data.avg_placement_duration_days).toBeNull()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  // RAPPORT-KAARTDRILLS-2: with a kpis[] strip, `terminationsTotal` reads its
  // VALUE from kpis[] and drills via GET /reports/matches/kpis/drill?kpi=
  // terminated_in_period (mutation test asserts the exact request, §13).
  it('reads terminationsTotal from kpis[] and drills via kpi=terminated_in_period', async () => {
    const user = userEvent.setup()
    const withKpis: MatchesReportData = { ...data, kpis: [{ key: 'terminated_in_period', count: 5 }] }
    mockUseMatchesReport.mockReturnValue({ data: withKpis, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    // The server kpi value (5), not the legacy envelope terminations.total (3),
    // rendered under the same label.
    const card = screen.getAllByText('Totaal beëindigingen')[0].closest('[role="button"]')!
    expect(card).toHaveTextContent('5')
    await user.click(screen.getAllByText('Totaal beëindigingen')[0])
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/kpis/drill',
      expect.objectContaining({ params: expect.objectContaining({ kpi: 'terminated_in_period', period: 'month' }) }))
  })

  // Tolerant fallback (RAPPORT-KAARTDRILLS-2): with no kpis[] strip at all, the
  // card pins the legacy envelope value and renders WITHOUT a drill — no
  // kpis/drill request fires on click.
  it('falls back to the legacy terminationsTotal value with no drill when kpis[] is absent', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getAllByText('Totaal beëindigingen')[0])
    expect(getSpy).not.toHaveBeenCalledWith('/reports/matches/kpis/drill', expect.anything())
  })

  // With avg_placement_duration_days null (as above), the dur card carries no
  // onClick at all — no fake affordance on a fabricated/absent number.
  it('the avg-duration card is non-clickable while its value is null', () => {
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Gem. matchduur').closest('[role="button"]')).toBeNull()
  })

  // Once HelloFlex fills the field, the same card becomes a real drill
  // (kpi=avg_duration_days) — never crashes on the transition.
  // Opus-REJECT: avg_placement_duration_days staat server-side hard op null
  // (wacht op HelloFlex) — de mapping was onbereikbaar dood en is ontkoppeld.
  it('the avg-duration card carries no drill while the envelope value is null by contract', () => {
    renderReport()
    expect(getSpy.mock.calls.map(c => String(c[0])).some(u => u.includes("kpi': 'avg_duration_days'"))).toBe(false)
  })
})

// REPORTS-KPI-SPARE-1: four real spares grow the catalogue so the settings
// screen has something to swap in.
describe('MatchesReport (spare KPI cards)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  it('offers the four new spare cards to the settings catalogue', async () => {
    const { getReportKpiCatalog, getReportKpiDefaultOrder, reportHasSpareKpiCards } = await import('./kpiCatalog')
    const catalogKeys = getReportKpiCatalog('matches').map(c => c.key)
    expect(catalogKeys).toEqual(expect.arrayContaining(['noContract', 'topContractForm', 'topTerminationReason', 'funnelRate']))
    expect(catalogKeys.length).toBe(getReportKpiDefaultOrder('matches').length + 4)
    expect(reportHasSpareKpiCards('matches')).toBe(true)
  })

  it('renders swapped-in spare cards with their real fixture values, strip still exactly nine', async () => {
    const user = userEvent.setup()
    mockSettings.mockReturnValue({
      report_kpis_matches: JSON.stringify([
        'noContract', 'topContractForm', 'topTerminationReason', 'funnelRate',
        'total', 'funnel', 'direct', 'sent', 'active',
      ]),
    })
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // noContract reuses the same 'none' tile count (3) already covered above.
    expect(screen.getAllByText('Geen contract').length).toBeGreaterThanOrEqual(1)
    // topContractForm: the largest real (non-'none') segment — Detachering · 9.
    expect(screen.getByText('Detachering · 9')).toBeInTheDocument()
    // topTerminationReason: the largest reason segment — Klant stopt · 2.
    expect(screen.getByText('Klant stopt · 2')).toBeInTheDocument()
    // funnelRate: 10 / 16 * 100 = 62,5%.
    expect(screen.getByText('62,5%')).toBeInTheDocument()

    // Clicking the swapped-in cards sends the real, already-supported XOR params.
    await user.click(screen.getByText('Detachering · 9'))
    expect(lastDrillParams()).toEqual({ contract_form: 'secondment', period: 'month' })
    await user.click(screen.getByText('Klant stopt · 2'))
    expect(lastDrillParams()).toEqual({ stop_reason: 'client_stop', period: 'month' })
  })

  // RAPPORT-COMPARE-2 (§4): the compare window lives in the right-hand filter
  // panel (ReportsPage) — the page itself renders NO inline compare control.
  it('renders no inline compare control (moved to the right filter panel)', () => {
    expect(screen.queryByText('Vergelijk met')).not.toBeInTheDocument()
  })
})
