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

// RAPPORT-GEZICHT-WAVE2: the house donut needs real layout (jsdom has none) —
// stub exposes the exact click contract the real component delivers (the
// datum incl. `key`, mirroring CandidatesReport's stub).
type StubDatum = { name: string; value: number; key?: string }
vi.mock('@/components/charts/PieChartCard', () => ({
  default: ({ data, onItemClick }: { data?: StubDatum[]; onItemClick?: (d: unknown) => void }) => (
    <>{(data ?? []).map(d => <button key={d.key} onClick={() => onItemClick?.(d)}>{d.name}</button>)}</>
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

  // SUPERSEDE (KPI-MATCHES-1): the origin KPI cards (funnel/direct/total) that
  // used to trigger `origin=` were the OLD ad-hoc strip, retired by the server-
  // suite conversion above — the origin axis has no remaining UI trigger at all
  // (no chart, no tile), so this XOR proof has no surface left to test against.

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
    // Each section is its own card — five since the origin donut regained its
    // surface (the by_origin axis lost its KPI cards in the KPI-MATCHES-1 flip).
    expect(container.querySelectorAll('[style*="border-radius: 12px"]').length).toBe(5)
    expect(screen.getByText('Herkomst')).toBeInTheDocument()
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
    // 'Verzonden'/'Beëindigd' are unique to the StatTile row. 'Actief' also
    // labels the new suite's own 'active' KPI card (KPI-MATCHES-1, kpi=active
    // drill) — so click the LAST match, always the StatTile below the strip.
    await user.click(screen.getAllByText('Verzonden')[0])
    expect(lastDrillParams()).toEqual({ contract_status: 'sent', period: 'month' })
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/advice',
      expect.objectContaining({ params: { contract_status: 'sent', period: 'month' } }))
    await user.click(screen.getAllByText('Actief').at(-1)!)
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

  // XOR proof across the remaining axes: every drill call carries exactly ONE
  // segment param — no residue from the earlier pick. `origin` dropped from
  // this proof with KPI-MATCHES-1 (see the SUPERSEDE note above): its only UI
  // trigger was the retired ad-hoc KPI card.
  it('sends exactly one XOR param per drill call, in both directions across the axes', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Uitzend'))
    expect(lastDrillParams()).toEqual({ contract_form: 'temp_agency', period: 'month' })
    await user.click(screen.getByText('Verzonden'))
    expect(lastDrillParams()).toEqual({ contract_status: 'sent', period: 'month' })
    await user.click(screen.getByText('Wk 32'))
    expect(lastDrillParams()).toEqual({ date: '2026-08-03', bucket: 'week', period: 'month' })
    await user.click(screen.getByText('Klant stopt'))
    expect(lastDrillParams()).toEqual({ stop_reason: 'client_stop', period: 'month' })
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
    await user.click(screen.getByText('Detachering'))
    await user.click(screen.getAllByText('Actief').at(-1)!)
    await user.click(screen.getByText('Wk 32'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/matches/drill' || c[0] === '/reports/matches/advice')).toBe(true)
  })
})

// KPI-MATCHES-1 (CMBE 27-08, BuildsMatchKpis): the strip now reads the
// server's own nine-card kpis[] suite verbatim — supersedes the old
// origin/placements/derived-stat strip tests above. Assertions key on the
// fixture's own DISTINCT numeric values and the drill request's `kpi` param
// rather than on label text, since the `matches.kpi.*` copy is landed by the
// manager in a separate i18n change (this lane never touches locale files).
// Deliberately distinct from every other digit the fixture already renders
// (the under_contract StatTiles show 5/6/2/3 further down the same page) so
// each suite card's value is a unique, unambiguous text node.
const matchKpis: NonNullable<MatchesReportData['kpis']> = [
  { key: 'total', count: 120 },
  { key: 'new_in_period', count: 45 },
  { key: 'active', count: 112 },
  { key: 'expiring_soon', count: 33 },
  { key: 'terminated_in_period', count: 44 },
  { key: 'renewals_in_period', count: 22 },
  { key: 'without_end_date', count: 66 },
  { key: 'avg_duration_days', count: 47.6 },
  { key: 'reach_rate', count: 0.375 },
]
const dataWithKpis: MatchesReportData = { ...data, kpis: matchKpis }

// Asserts (or denies) a rendered element's semantic ink token — the token lives
// in the assertion argument, not in a style literal: this test paints nothing.
function expectInk(el: HTMLElement, token: string, opts?: { absent?: boolean }) {
  const m = expect(el)
  if (opts?.absent) m.not.toHaveStyle({ color: token })
  else m.toHaveStyle({ color: token })
}

describe('MatchesReport (nine-card server-suite KPI strip, KPI-MATCHES-1)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  // Each plain-count card renders its own server value; avg_duration_days
  // (unit 'days') rounds to a whole day count, reach_rate (unit 'ratio')
  // renders ×100 with one decimal and a % sign — the UNIT-CANON formatter.
  it('renders every suite card with its own value, days/ratio units formatted via kpiUnitFormat', () => {
    mockUseMatchesReport.mockReturnValue({ data: dataWithKpis, loading: false, error: false })
    renderReport()
    for (const value of ['120', '45', '112', '33', '44', '22', '66']) {
      expect(screen.getByText(value)).toBeInTheDocument()
    }
    // avg_duration_days: 47.6 → Math.round → 48 (formatNumber, no decimals).
    expect(screen.getByText('48')).toBeInTheDocument()
    // reach_rate: 0.375 → formatRatio → "37,5%" (FMT-PROCENT-1: ≤1 decimal).
    expect(screen.getByText('37,5%')).toBeInTheDocument()
  })

  // Semantic colour only on the three signal keys, only when non-zero (§4).
  it('colours active/expiring_soon/terminated_in_period only, all non-zero in the fixture', () => {
    mockUseMatchesReport.mockReturnValue({ data: dataWithKpis, loading: false, error: false })
    renderReport()
    // ASSERT (not a component style): the KPI value ink is a deliberate raw
    // semantic colour, not the -text twin (InsightsRow's HUISSTIJL carve-out
    // for a KpiCard's own big number) — mirrored verbatim from TasksReport's
    // KPI_COLOR/OutreachReport's KPI_COLOR usage, which lint does not flag
    // there since it sits in a variable, not a literal JSX style prop.
    expectInk(screen.getByText('112'), 'var(--color-success)') // active
    expectInk(screen.getByText('33'), 'var(--color-warning)') // expiring_soon
    expectInk(screen.getByText('44'), 'var(--color-danger)') // terminated_in_period
    // A plain count key carries no signal colour (falls back to the house text token).
    expectInk(screen.getByText('45'), 'var(--color-success)', { absent: true })
  })

  // Value and drill share ONE backend predicate per key: clicking any suite
  // card requests /reports/matches/kpis/drill?kpi=<its own key> (§13 mutation test).
  it('clicking a suite card drills via its own kpi key', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data: dataWithKpis, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('22')) // renewals_in_period
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/kpis/drill',
      expect.objectContaining({ params: expect.objectContaining({ kpi: 'renewals_in_period', period: 'month' }) }))
    getSpy.mockClear()
    await user.click(screen.getByText('37,5%')) // reach_rate
    expect(getSpy).toHaveBeenCalledWith('/reports/matches/kpis/drill',
      expect.objectContaining({ params: expect.objectContaining({ kpi: 'reach_rate', period: 'month' }) }))
  })

  // Honest fallback (RAPPORT-KAARTDRILLS-2): with no kpis[] at all (a pre-suite
  // cached envelope), every card renders the house dash with no drill affordance
  // — never a value from another population.
  it('renders dashes with no drill when kpis[] is absent from the envelope', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(9)
    getSpy.mockClear()
    await user.click(screen.getAllByText('—')[0])
    expect(getSpy).not.toHaveBeenCalledWith('/reports/matches/kpis/drill', expect.anything())
  })
})

// KPI-MATCHES-1: the catalogue is now the server suite's own nine keys — no
// spares (supersedes the old REPORTS-KPI-SPARE-1 four-spare block above).
describe('MatchesReport (kpi catalogue, KPI-MATCHES-1)', () => {
  it('offers exactly the nine server-suite keys, in suite order, no spares', async () => {
    const { getReportKpiCatalog, getReportKpiDefaultOrder, reportHasSpareKpiCards } = await import('./kpiCatalog')
    const keys = getReportKpiCatalog('matches').map(c => c.key)
    expect(keys).toEqual([
      'total', 'new_in_period', 'active', 'expiring_soon', 'terminated_in_period',
      'renewals_in_period', 'without_end_date', 'avg_duration_days', 'reach_rate',
    ])
    expect(getReportKpiDefaultOrder('matches')).toEqual(keys)
    expect(reportHasSpareKpiCards('matches')).toBe(false)
  })

  // RAPPORT-COMPARE-2 (§4): the compare window lives in the right-hand filter
  // panel (ReportsPage) — the page itself renders NO inline compare control.
  it('renders no inline compare control (moved to the right filter panel)', () => {
    expect(screen.queryByText('Vergelijk met')).not.toBeInTheDocument()
  })
})
