import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import OpportunitiesReport from './OpportunitiesReport'
import i18n from '@/i18n'
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
  it('sends the active panel filters to BOTH the report hook and a kpi drill click', async () => {
    const user = userEvent.setup()
    const filters = { ...EMPTY_REPORT_FILTERS, status: ['won'], ownerId: ['u1'], locationId: [7], customerId: ['c1'], valueMin: 1000, valueMax: 5000 }
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    render(<QueryClientProvider client={new QueryClient()}><OpportunitiesReport period="month" filters={filters} /></QueryClientProvider>)
    expect(mockUseOpportunitiesReport).toHaveBeenCalledWith('month', filters)
    await user.click(screen.getByText(i18n.t('opportunities.total', { ns: 'analytics' })))
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/kpis/drill', expect.objectContaining({
      params: expect.objectContaining({ kpi: 'total', period: 'month', status: ['won'], owner_id: ['u1'], location_id: [7], customer_id: ['c1'], value_min: 1000, value_max: 5000 }),
    }))
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

  // Pipeline-health KPI strip from the envelope totals.
  it('renders the pipeline-health KPI strip from totals', () => {
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal kansen')).toBeInTheDocument()
    expect(screen.getByText('Gewonnen')).toBeInTheDocument()
    expect(screen.getByText('Verloren')).toBeInTheDocument()
    expect(screen.getByText('Winratio')).toBeInTheDocument()
  })

  // WAVE-1B: the total card's key maps 1:1 onto the kpis/drill enum ('total') —
  // clicking it opens the shared drawer via GET /reports/opportunities/kpis/drill.
  it('clicking the total KPI card drills via /reports/opportunities/kpis/drill with kpi=total', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Totaal kansen'))
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/kpis/drill',
      expect.objectContaining({ params: { kpi: 'total', period: 'month' } }))
  })

  // WAVE-1B: closingSoon maps onto kpi=closing_soon (distinct from the plain
  // /reports/opportunities/drill route, which has no matching XOR key).
  it('clicking the closingSoon KPI card drills via /reports/opportunities/kpis/drill with kpi=closing_soon', async () => {
    const user = userEvent.setup()
    // mockReturnValueOnce: this test's stored order must not leak into later
    // tests in this file (mockReturnValue would persist across suites).
    mockSettings.mockReturnValueOnce({
      report_kpis_opportunities: JSON.stringify([
        'closingSoon', 'total', 'open', 'won', 'lost', 'winRate', 'untouched', 'overdue', 'forecastCount',
      ]),
    })
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Sluit binnenkort'))
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/opportunities/drill')).toBe(false)
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/kpis/drill',
      expect.objectContaining({ params: { kpi: 'closing_soon', period: 'month' } }))
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

// Nine-card KPI footprint (Danny — same as the dashboard, all reports). The
// pipeline five stay as-is; stale.untouched/overdue and the forecast sums are
// real sums over fields the endpoint already returns — WAVE-1B: all four now
// drill via GET /reports/opportunities/kpis/drill (their key maps 1:1 onto the
// kpi enum), so all four render as real clickable cards.
describe('OpportunitiesReport (nine-card KPI footprint)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  it('renders exactly nine KPI cards from the fixture', () => {
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal kansen')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Gewonnen')).toBeInTheDocument()
    expect(screen.getByText('Verloren')).toBeInTheDocument()
    expect(screen.getByText('Winratio')).toBeInTheDocument()
    expect(screen.getByText('Onaangeraakt')).toBeInTheDocument()
    expect(screen.getByText('Verwachte deals')).toBeInTheDocument()
    expect(screen.getByText('Verwachte waarde')).toBeInTheDocument()
    // The stale.untouched (1) and stale.overdue (1) counts render as their own tiles.
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2)
    // forecast[].count sums to 2 (a real sum over the returned array, not
    // fabricated) — 'lost' also renders as 2, so assert via count, not uniqueness.
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2)
    // forecast[].value_sum sums to €8.000 via the house currency formatter.
    expect(screen.getByText('€ 8.000')).toBeInTheDocument()
  })

  // WAVE-1B: untouched/overdue/forecastCount/forecastValue now drill via
  // kpis/drill?kpi=<untouched|overdue|forecast_count|forecast_value>.
  it('the stale and forecast KPI cards drill via kpis/drill with their own kpi key', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    for (const [label, kpi] of [
      ['Onaangeraakt', 'untouched'], ['Verwachte deals', 'forecast_count'], ['Verwachte waarde', 'forecast_value'],
    ] as const) {
      const card = screen.getByText(label).closest('div[role="button"]')
      expect(card).not.toBeNull()
      await user.click(card as HTMLElement)
      expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/kpis/drill',
        expect.objectContaining({ params: { kpi, period: 'month' } }))
    }
  })
})

// REPORTS-KPI-SPARE-1 (+KPI-DREMPELS-FE-1): six real spares grow the catalogue
// so the settings screen has something to swap in.
describe('OpportunitiesReport (spare KPI cards)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  it('offers the six new spare cards to the settings catalogue', async () => {
    const { getReportKpiCatalog, getReportKpiDefaultOrder, reportHasSpareKpiCards } = await import('./kpiCatalog')
    const catalogKeys = getReportKpiCatalog('opportunities').map(c => c.key)
    expect(catalogKeys).toEqual(expect.arrayContaining(['openValue', 'wonValue', 'topStage', 'topCustomer', 'staleDeal', 'closingSoon']))
    expect(catalogKeys.length).toBe(getReportKpiDefaultOrder('opportunities').length + 6)
    expect(reportHasSpareKpiCards('opportunities')).toBe(true)
  })

  // KPI-DREMPELS-FE-1: totals.stale / totals.closing_soon render their real
  // fixture counts with the tenant threshold as a caption. WAVE-1B: both now map
  // 1:1 onto the kpis/drill enum (stale/closing_soon) and drill on click.
  it('renders staleDeal/closingSoon with their threshold caption and drills via kpis/drill', async () => {
    const user = userEvent.setup()
    mockSettings.mockReturnValue({
      report_kpis_opportunities: JSON.stringify([
        'staleDeal', 'closingSoon', 'total', 'open', 'won', 'lost', 'winRate', 'openValue', 'wonValue',
      ]),
    })
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()

    const staleDealLabel = screen.getByText('Stilstaande kansen')
    const staleDealCard = staleDealLabel.parentElement as HTMLElement
    expect(within(staleDealCard).getByText('2')).toBeInTheDocument()
    expect(within(staleDealCard).getByText('Drempel: 30 dagen')).toBeInTheDocument()
    const staleDealButton = staleDealCard.closest('div[role="button"]')
    expect(staleDealButton).not.toBeNull()
    await user.click(staleDealButton as HTMLElement)
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/kpis/drill',
      expect.objectContaining({ params: { kpi: 'stale', period: 'month' } }))

    const closingSoonLabel = screen.getByText('Sluit binnenkort')
    const closingSoonCard = closingSoonLabel.parentElement as HTMLElement
    expect(within(closingSoonCard).getByText('3')).toBeInTheDocument()
    expect(within(closingSoonCard).getByText('Drempel: 14 dagen')).toBeInTheDocument()
    const closingSoonButton = closingSoonCard.closest('div[role="button"]')
    expect(closingSoonButton).not.toBeNull()
    await user.click(closingSoonButton as HTMLElement)
    expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/kpis/drill',
      expect.objectContaining({ params: { kpi: 'closing_soon', period: 'month' } }))
  })

  it('renders swapped-in spare cards with their real fixture values, strip still exactly nine', async () => {
    const user = userEvent.setup()
    mockSettings.mockReturnValue({
      report_kpis_opportunities: JSON.stringify([
        'openValue', 'wonValue', 'topStage', 'topCustomer',
        'total', 'open', 'won', 'lost', 'winRate',
      ]),
    })
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // totals.open_value/won_value, real money fields, via the house formatter.
    expect(screen.getByText('€ 25.000')).toBeInTheDocument()
    expect(screen.getByText('€ 18.000')).toBeInTheDocument()
    // topStage: the largest real (non-'none') stage segment — Voorstel · 6.
    expect(screen.getByText('Voorstel · 6')).toBeInTheDocument()
    // topCustomer: the largest real (non-'none'/'others') customer — Careyn · 5.
    expect(screen.getByText('Careyn · 5')).toBeInTheDocument()

    // Clicking reuses the page's own stage/customer axis drill (already covered
    // elsewhere for the bars — the KPI card sends the identical XOR param).
    await user.click(screen.getByText('Voorstel · 6'))
    await waitFor(() => expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/drill',
      expect.objectContaining({ params: expect.objectContaining({ stage: 'proposal' }) })))
    await user.click(screen.getByText('Careyn · 5'))
    await waitFor(() => expect(getSpy).toHaveBeenCalledWith('/reports/opportunities/drill',
      expect.objectContaining({ params: expect.objectContaining({ customer: 'cust-1' }) })))
  })

  // RAPPORT-COMPARE-2 (§4): the compare window lives in the right-hand filter
  // panel (ReportsPage) — the page itself renders NO inline compare control.
  it('renders no inline compare control (moved to the right filter panel)', () => {
    expect(screen.queryByText('Vergelijk met')).not.toBeInTheDocument()
  })
})
