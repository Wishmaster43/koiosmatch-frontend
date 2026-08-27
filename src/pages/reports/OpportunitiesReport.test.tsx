import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import OpportunitiesReport from './OpportunitiesReport'
import { EMPTY_REPORT_FILTERS } from './reportFilterParams'
import type { OpportunitiesReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseOpportunitiesReport = vi.fn()
vi.mock('./useOpportunitiesReport', () => ({ useOpportunitiesReport: (...args: unknown[]) => mockUseOpportunitiesReport(...args) }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn()
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

const data: OpportunitiesReportData = {
  period: { from: '2026-05-14', to: '2026-08-14' },
  total: 12,
  timeseries: { bucket: 'week', series: [
    { date: '2026-08-03', label: 'Wk 32', value: 5 },
    { date: '2026-08-10', label: 'Wk 33', value: 7 },
  ] },
  totals: {
    total: 12, open: 6, won: 4, lost: 2, win_rate: 66.7, open_value: 25000, open_hours: 120, won_value: 18000,
    stale: 2, stale_days: 30, closing_soon: 3, closing_soon_days: 14,
  },
  by_stage: [
    // eslint-disable-next-line no-restricted-syntax -- API fixture colour (DATA, mirrors the live row)
    { key: 'proposal', value: 'proposal', label: 'Voorstel', color: '#2563eb', count: 6, value_sum: 15000 },
    { key: 'none', value: 'none', label: 'Geen fase', color: null, count: 3, value_sum: 0 },
    { key: '9c1d-deleted-stage-uuid', value: '9c1d-deleted-stage-uuid', label: 'Onbekend (verwijderde fase)', color: null, count: 3, value_sum: 2500 },
  ],
  by_owner: [
    { owner_id: 'u1', name: 'Anna de Vries', count: 9 },
    { owner_id: 'none', name: 'Niet toegewezen', count: 3 },
  ],
  by_customer: [
    { customer_id: 'cust-1', value: 'cust-1', name: 'Careyn', label: 'Careyn', count: 5, value_sum: 12000 },
    { customer_id: 'f0a3-deleted-customer-uuid', value: 'f0a3-deleted-customer-uuid', name: 'Onbekend', label: 'Onbekend', count: 3, value_sum: 900 },
    { customer_id: 'none', value: 'none', name: 'Geen klant', label: 'Geen klant', count: 2, value_sum: 0 },
    { customer_id: 'others', value: 'others', name: 'Overig', label: 'Overig', count: 2, value_sum: 400 },
  ],
  by_branch: [
    { value: 'loc-1', label: 'Utrecht', count: 10 },
    { value: 'none', label: 'Geen vestiging', count: 2 },
  ],
  forecast: [{ month: '2026-09', count: 2, value_sum: 8000 }],
  stale: { untouched_days: 30, untouched: 1, overdue: 1 },
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <OpportunitiesReport period="month" />
    </QueryClientProvider>,
  )
}

// The last drill call's raw params — for the XOR proofs (exactly ONE segment param).
const lastDrillParams = () =>
  (getSpy.mock.calls.filter(c => c[0] === '/reports/opportunities/drill').at(-1)?.[1] as { params: Record<string, unknown> }).params

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
// (donut: the datum incl. `key`; bar: the original ChartDatum).
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

// RAPPORT-FILTERS (wave 1c): the panel filters reach BOTH the report hook and a
// KPI drill click — incl. the opportunities-only value range (§13 seam pin).
describe('OpportunitiesReport · panel filters reach hook and drill', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  // KPI-OPP-1: the strip now reads the server suite — assert on the fixture's
  // own numeric value/kpi key rather than label text (labels land via a
  // separate i18n change this lane never touches).
  it('sends the active panel filters to BOTH the report hook and a kpi drill click', async () => {
    const user = userEvent.setup()
    const filters = { ...EMPTY_REPORT_FILTERS, status: ['won'], ownerId: ['u1'], locationId: [7], customerId: ['c1'], valueMin: 1000, valueMax: 5000 }
    mockUseOpportunitiesReport.mockReturnValue({ data: { ...data, kpis: opportunityKpis }, loading: false, error: false })
    render(<QueryClientProvider client={new QueryClient()}><OpportunitiesReport period="month" filters={filters} /></QueryClientProvider>)
    expect(mockUseOpportunitiesReport).toHaveBeenCalledWith('month', filters)
    await user.click(screen.getByText('120'))
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/kpis/drill', expect.objectContaining({
      params: expect.objectContaining({ kpi: 'total', period: 'month', status: ['won'], owner_id: ['u1'], location_id: [7], customer_id: ['c1'], value_min: 1000, value_max: 5000 }),
    }))
  })

  // K-192: advice now validates the panel filters exactly like the drill (see
  // getReportsOpportunitiesAdvice, api-generated.ts:46593) — a segment click sends
  // the same panel filters to BOTH endpoints, not just the window.
  it('sends the active panel filters to advice as well as drill on a segment click', async () => {
    const user = userEvent.setup()
    const filters = { ...EMPTY_REPORT_FILTERS, status: ['won'], ownerId: ['u1'], locationId: [7], customerId: ['c1'], valueMin: 1000, valueMax: 5000 }
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    render(<QueryClientProvider client={new QueryClient()}><OpportunitiesReport period="month" filters={filters} /></QueryClientProvider>)
    await user.click(screen.getByText('Voorstel'))
    const wantParams = { stage: 'proposal', period: 'month', status: ['won'], owner_id: ['u1'], location_id: [7], customer_id: ['c1'], value_min: 1000, value_max: 5000 }
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/drill', expect.objectContaining({ params: expect.objectContaining(wantParams) }))
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/advice', expect.objectContaining({ params: expect.objectContaining(wantParams) }))
  })
})

describe('OpportunitiesReport (RAPPORTEN-SUITE-1 portie 5, kansen pipeline report)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  it('shows the loading state', () => {
    mockUseOpportunitiesReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Kansen laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseOpportunitiesReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de kansen niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no opportunities', () => {
    mockUseOpportunitiesReport.mockReturnValue({
      data: { ...data, total: 0, by_stage: [], by_owner: [], by_customer: [], by_branch: [],
        timeseries: { bucket: 'week', series: [] },
        totals: { total: 0, open: 0, won: 0, lost: 0, win_rate: null, open_value: 0, open_hours: 0, won_value: 0,
          stale: 0, stale_days: 30, closing_soon: 0, closing_soon_days: 14 } },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen kansen in deze periode')).toBeInTheDocument()
  })

  // Contract: every axis renders every segment (incl. 'none'/'others'/orphans) and
  // sums exactly to the report total.
  it('renders every axis with every segment, each axis summing to the report total', () => {
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    for (const label of ['Wk 32', 'Wk 33', 'Voorstel', 'Geen fase', 'Onbekend (verwijderde fase)',
      'Careyn', 'Onbekend', 'Geen klant', 'Overig', 'Anna de Vries', 'Niet toegewezen',
      'Utrecht', 'Geen vestiging']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(data.by_stage.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_customer.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_owner.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_branch.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.timeseries.series.reduce((s, p) => s + p.value, 0)).toBe(data.total)
  })

  // BELANGRIJK per contract: the window must be prominent, DD-MM-YYYY — never ISO
  // (CLAUDE.md §3B DATUM-1). This envelope nests the window under `period`.
  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Kansen 14-05-2026 t/m 14-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-05-14/)).not.toBeInTheDocument()
  })

  it('clicking a stage bar drills with the stage XOR param (drill + advice)', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Voorstel'))
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/drill',
      expect.objectContaining({ params: { stage: 'proposal', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/advice',
      expect.objectContaining({ params: { stage: 'proposal', period: 'month' } }))
  })

  // 'none' sentinel: drills with the axis param only — NO other XOR param rides along.
  it('clicking the "Geen fase" sentinel drills with stage=none and no other XOR param', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Geen fase'))
    expect(lastDrillParams()).toEqual({ stage: 'none', period: 'month' })
  })

  // Orphan-value drill: opportunity_stage_id carries no FK, so a deleted stage still
  // renders its own bar with the backend's "Onbekend (…)" label and drills on the RAW uuid.
  it('renders an orphaned (deleted-stage) row as its own bar and drills on the raw uuid', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend (verwijderde fase)'))
    expect(lastDrillParams()).toEqual({ stage: '9c1d-deleted-stage-uuid', period: 'month' })
  })

  // 'others' = the exact complement of the top-20 — a real, clickable row.
  it('clicking the customer "Overig" bar drills with customer=others', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Overig'))
    expect(lastDrillParams()).toEqual({ customer: 'others', period: 'month' })
  })

  it('clicking the customer "Geen klant" bar drills with customer=none', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Geen klant'))
    expect(lastDrillParams()).toEqual({ customer: 'none', period: 'month' })
  })

  // Wees-klant-les (portie 5 review HIGH): a hard-deleted customer's "Onbekend" bar
  // still opens — it drills on the raw uuid like any other segment.
  it('clicking a hard-deleted customer "Onbekend" bar drills on that raw uuid', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend'))
    expect(lastDrillParams()).toEqual({ customer: 'f0a3-deleted-customer-uuid', period: 'month' })
  })

  it('clicking an owner bar drills with the owner XOR param (D2 shape: owner_id → owner)', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // Anna de Vries (u1) is also the mount-seeded top owner segment, so the
    // click may hit the react-query cache — assert via toHaveBeenCalledWith
    // (any matching call, mount-seeded or click-fired), never "the last call".
    await user.click(screen.getByText('Anna de Vries'))
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/drill',
      expect.objectContaining({ params: { owner: 'u1', period: 'month' } }))
    // "Niet toegewezen" differs from the mount default, so it always fires fresh.
    await user.click(screen.getByText('Niet toegewezen'))
    expect(lastDrillParams()).toEqual({ owner: 'none', period: 'month' })
  })

  // Branch axis runs on the deal's OWN location_id column and drills through the
  // REPORT drill's `branch` param — never the /opportunities list filter.
  it('clicking a branch bar drills with the branch XOR param (incl. the none sentinel)', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Utrecht'))
    expect(lastDrillParams()).toEqual({ branch: 'loc-1', period: 'month' })
    await user.click(screen.getByText('Geen vestiging'))
    expect(lastDrillParams()).toEqual({ branch: 'none', period: 'month' })
    expect(getSpy.mock.calls.some(c => String(c[0]).startsWith('/opportunities'))).toBe(false)
  })

  // GRANULARITY role of `bucket` (dual-role contract): a week timeseries bar drills
  // with date=<key> + bucket=week so bar and drawer totals always agree.
  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 32'))
    expect(lastDrillParams()).toEqual({ date: '2026-08-03', bucket: 'week', period: 'month' })
  })

  it('omits bucket when the timeseries is day-granular', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({
      data: { ...data, timeseries: { bucket: 'day', series: [{ date: '2026-08-03', label: '03-08', value: 2 }] } },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('03-08'))
    // The mount default ALSO seeds the series section with this exact single day
    // point, so the click may hit the react-query cache — assert via
    // toHaveBeenCalledWith (any matching call), never "the last call".
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/drill',
      expect.objectContaining({ params: { date: '2026-08-03', period: 'month' } }))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/opportunities/drill' &&
      (c[1] as { params: Record<string, unknown> }).params.date === '2026-08-03')
    expect(call?.[1].params).not.toHaveProperty('bucket')
  })

  // Every drill source targets the ONE opportunities drill/advice pair — never a
  // sibling report's endpoint, never an entity list route.
  it('always drills via /reports/opportunities/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Voorstel'))
    await user.click(screen.getByText('Careyn'))
    await user.click(screen.getByText('Anna de Vries'))
    await user.click(screen.getByText('Wk 33'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/opportunities/drill' || c[0] === '/reports/opportunities/advice')).toBe(true)
  })

  // Calm 403 degrade: the drill rows need opportunities.view on top of reports.view —
  // the shared ReportDrillDrawer hides the rows section entirely on a 403 (own
  // rule: "the segment's own data permission was denied … no error banner, the
  // advice section still shows"), never an error banner.
  it('degrades calmly (no error banner) when the rows request is 403-forbidden', async () => {
    const user = userEvent.setup()
    getSpy.mockImplementation((url: unknown) => String(url).endsWith('/drill')
      ? Promise.reject({ response: { status: 403 } })
      : Promise.resolve({ data: { advice: 'Bel deze klant deze week nog.' } }))
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Voorstel'))
    await waitFor(() => expect(screen.getByText('Bel deze klant deze week nog.')).toBeInTheDocument())
    expect(screen.queryByText(/fout|mislukt|error|forbidden/i)).not.toBeInTheDocument()
  })

  // A drill row renders its title + "stage · customer" subtitle via the shared
  // rowSub, exactly like the drawer did — no error on a normal, successful fetch.
  it('renders no error on a successful drill fetch and shows the customer in the row subtitle', async () => {
    const user = userEvent.setup()
    getSpy.mockImplementation((url: unknown) => String(url).endsWith('/advice')
      ? Promise.resolve({ data: { advice: null } })
      : Promise.resolve({ data: {
          data: [{ id: 'o1', entity: 'opportunity', title: 'Deal Careyn wondzorg', stage: 'Voorstel', customer: 'Careyn', owner: 'Anna de Vries', value: 12000 }],
          meta: { total: 1 },
        } }))
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Geen fase'))
    // The generic mock answers every section's drill fetch identically (mount
    // seeds five sections too), so the row can legitimately appear more than once.
    await waitFor(() => expect(screen.getAllByText('Deal Careyn wondzorg').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Voorstel · Careyn').length).toBeGreaterThan(0)
    expect(screen.queryByText(/fout|mislukt|error/i)).not.toBeInTheDocument()
  })

  // REPORTGRID-1: the shared drill drawer opens only on click, never
  // auto-defaulted on mount.
  it('never fires a drill request before any segment is clicked', () => {
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(getSpy).not.toHaveBeenCalled()
  })

  // Clicking a segment in ONE chart never changes another chart's list — each
  // section keeps its own independent drill state.
  it('clicking a segment in one chart never changes another chart\'s list', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    // "Geen vestiging" is not the top branch segment (Utrecht is), so it is
    // guaranteed to differ from the mount default and fire a fresh request.
    await user.click(screen.getByText('Geen vestiging'))
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/drill',
      expect.objectContaining({ params: { branch: 'none', period: 'month' } }))
    // The stage section was never re-fetched by the branch click.
    expect(getSpy).not.toHaveBeenCalledWith('/reports/opportunities/drill',
      expect.objectContaining({ params: expect.objectContaining({ stage: expect.anything() }) }))
  })
})

// KPI-OPP-1 (CMBE 27-08, commit eb3af985): the strip now reads the server's own
// nine-card kpis[] suite verbatim — supersedes the old totals/forecast-derived
// strip tests above. Assertions key on the fixture's own DISTINCT numeric
// values and the drill request's `kpi` param rather than on label text, since
// the `opportunities.kpi.*` copy already exists (see the ground-rule note) but
// this lane never re-verifies locale-file content. Deliberately distinct from
// every other digit the fixture already renders elsewhere on the page.
const opportunityKpis: NonNullable<OpportunitiesReportData['kpis']> = [
  { key: 'total', count: 120 },
  { key: 'open', count: 55 },
  { key: 'won', count: 41 },
  { key: 'lost', count: 14 },
  { key: 'win_rate', count: 74.5, unit: 'pct' },
  { key: 'open_value', count: 32000, unit: 'euro' },
  { key: 'stale', count: 6 },
  { key: 'closing_soon', count: 9 },
  { key: 'overdue', count: 3 },
]
const dataWithKpis: OpportunitiesReportData = { ...data, kpis: opportunityKpis }

// Asserts (or denies) a rendered element's semantic ink token — the token lives
// in the assertion argument, not in a style literal: this test paints nothing.
function expectInk(el: HTMLElement, token: string, opts?: { absent?: boolean }) {
  const m = expect(el)
  if (opts?.absent) m.not.toHaveStyle({ color: token })
  else m.toHaveStyle({ color: token })
}

describe('OpportunitiesReport (nine-card server-suite KPI strip, KPI-OPP-1)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  // ACTIVE-KPI-CARD-1 re-pin (existed at HEAD, dropped in the flip): the card
  // whose kpi-drill is open renders the active border; jsdom cannot resolve CSS
  // vars via toHaveStyle, so assert the raw style string (HEAD idiom).
  it('marks a KPI card active while its drill is open', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data: dataWithKpis, loading: false, error: false })
    renderReport()
    const card = screen.getByRole('button', { name: /Zonder update/ })
    expect(card.getAttribute('style')).toContain('border-color: var(--border)')
    await user.click(screen.getByText('Zonder update'))
    expect(card.getAttribute('style')).toContain('border-color: var(--color-primary)')
  })

  // Each plain-count card renders its own server value; win_rate (unit 'pct')
  // and open_value (unit 'euro') render via the UNIT-CANON kpiUnitFormat.
  it('renders every suite card with its own value, pct/euro units formatted via kpiUnitFormat', () => {
    mockUseOpportunitiesReport.mockReturnValue({ data: dataWithKpis, loading: false, error: false })
    renderReport()
    for (const value of ['120', '55', '41', '14', '6', '9', '3']) {
      expect(screen.getByText(value)).toBeInTheDocument()
    }
    // win_rate 74.5 unit pct → formatPercent renders as-is (0..100), one decimal.
    expect(screen.getByText('74,5%')).toBeInTheDocument()
    // open_value 32000 unit euro → the house currency formatter (kpiUnitFormat
    // default fraction digits, unlike the page's own formatCurrency(…, 0) calls
    // elsewhere on this page).
    expect(screen.getByText('€ 32.000,00')).toBeInTheDocument()
  })

  // Semantic colour only on the signal keys, only when non-zero (§4).
  it('colours won/lost/stale/closing_soon/overdue only, all non-zero in the fixture', () => {
    mockUseOpportunitiesReport.mockReturnValue({ data: dataWithKpis, loading: false, error: false })
    renderReport()
    expectInk(screen.getByText('41'), 'var(--color-success)') // won
    expectInk(screen.getByText('14'), 'var(--color-danger)') // lost
    expectInk(screen.getByText('6'), 'var(--color-warning)') // stale
    expectInk(screen.getByText('9'), 'var(--color-warning)') // closing_soon
    expectInk(screen.getByText('3'), 'var(--color-danger)') // overdue
    // A plain count key carries no signal colour (falls back to the house text token).
    expectInk(screen.getByText('55'), 'var(--color-success)', { absent: true }) // open
  })

  // Value and drill share ONE backend predicate per key: clicking any suite
  // card requests /reports/opportunities/kpis/drill?kpi=<its own key> (§13 mutation test).
  it('clicking a suite card drills via its own kpi key', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data: dataWithKpis, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('9')) // closing_soon
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/kpis/drill',
      expect.objectContaining({ params: expect.objectContaining({ kpi: 'closing_soon', period: 'month' }) }))
    getSpy.mockClear()
    await user.click(screen.getByText('74,5%')) // win_rate
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/kpis/drill',
      expect.objectContaining({ params: expect.objectContaining({ kpi: 'win_rate', period: 'month' }) }))
  })

  // Honest fallback (RAPPORT-KAARTDRILLS-2): with no kpis[] at all (a pre-suite
  // cached envelope), every card renders the house dash with no drill affordance
  // — never a value from another population.
  it('renders dashes with no drill when kpis[] is absent from the envelope', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(9)
    getSpy.mockClear()
    await user.click(screen.getAllByText('—')[0])
    expect(getSpy).not.toHaveBeenCalledWith('/reports/opportunities/kpis/drill', expect.anything())
  })
})

// KPI-OPP-1: the catalogue is now the server suite's own nine keys — no spares
// (supersedes the old REPORTS-KPI-SPARE-1 six-spare block).
describe('OpportunitiesReport (kpi catalogue, KPI-OPP-1)', () => {
  it('offers exactly the nine server-suite keys, in suite order, no spares', async () => {
    const { getReportKpiCatalog, getReportKpiDefaultOrder, reportHasSpareKpiCards } = await import('./kpiCatalog')
    const keys = getReportKpiCatalog('opportunities').map(c => c.key)
    expect(keys).toEqual([
      'total', 'open', 'won', 'lost', 'win_rate', 'open_value', 'stale', 'closing_soon', 'overdue',
    ])
    expect(getReportKpiDefaultOrder('opportunities')).toEqual(keys)
    expect(reportHasSpareKpiCards('opportunities')).toBe(false)
  })

  // RAPPORT-COMPARE-2 (§4): the compare window lives in the right-hand filter
  // panel (ReportsPage) — the page itself renders NO inline compare control.
  it('renders no inline compare control (moved to the right filter panel)', () => {
    expect(screen.queryByText('Vergelijk met')).not.toBeInTheDocument()
  })
})

