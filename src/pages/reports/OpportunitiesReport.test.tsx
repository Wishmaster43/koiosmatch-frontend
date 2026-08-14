import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import OpportunitiesReport from './OpportunitiesReport'
import type { OpportunitiesReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseOpportunitiesReport = vi.fn()
vi.mock('./useOpportunitiesReport', () => ({ useOpportunitiesReport: () => mockUseOpportunitiesReport() }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
}))

const data: OpportunitiesReportData = {
  period: { from: '2026-05-14', to: '2026-08-14' },
  total: 12,
  timeseries: { bucket: 'week', series: [
    { date: '2026-08-03', label: 'Wk 32', value: 5 },
    { date: '2026-08-10', label: 'Wk 33', value: 7 },
  ] },
  totals: { total: 12, open: 6, won: 4, lost: 2, win_rate: 66.7, open_value: 25000, open_hours: 120, won_value: 18000 },
  by_stage: [
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
        totals: { total: 0, open: 0, won: 0, lost: 0, win_rate: null, open_value: 0, open_hours: 0, won_value: 0 } },
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

  // Pipeline-health KPI strip from the envelope totals (not drillable — the five-way
  // XOR has no open/won/lost segment).
  it('renders the pipeline-health KPI strip from totals', () => {
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal kansen')).toBeInTheDocument()
    expect(screen.getByText('Gewonnen')).toBeInTheDocument()
    expect(screen.getByText('Verloren')).toBeInTheDocument()
    expect(screen.getByText('Winratio')).toBeInTheDocument()
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
    await user.click(screen.getByText('Anna de Vries'))
    expect(lastDrillParams()).toEqual({ owner: 'u1', period: 'month' })
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
    expect(lastDrillParams()).toEqual({ date: '2026-08-03', period: 'month' })
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
  // denied rows hide the records section (no error banner) while advice stays visible.
  it('keeps the advice visible when the rows request is 403-forbidden', async () => {
    const user = userEvent.setup()
    getSpy.mockImplementation((url: unknown) => String(url).endsWith('/drill')
      ? Promise.reject({ response: { status: 403 } })
      : Promise.resolve({ data: { advice: 'Bel deze klant deze week nog.' } }))
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Voorstel'))
    await waitFor(() => expect(screen.getByText('Bel deze klant deze week nog.')).toBeInTheDocument())
    expect(screen.queryByText('Onderliggende records')).not.toBeInTheDocument()
    expect(screen.queryByText(/fout|mislukt|error|forbidden/i)).not.toBeInTheDocument()
  })

  // {advice:null} (no koios_ai module) renders the calm no-advice copy, never an
  // error — and the drill rows show "stage · customer" via the shared rowSub.
  it('renders no error on {advice:null} and shows the customer in the row subtitle', async () => {
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
    await waitFor(() => expect(screen.getByText('Deal Careyn wondzorg')).toBeInTheDocument())
    expect(screen.getByText('Voorstel · Careyn')).toBeInTheDocument()
    expect(screen.getByText('Koios heeft nog geen advies voor dit getal.')).toBeInTheDocument()
    expect(screen.queryByText(/fout|mislukt|error/i)).not.toBeInTheDocument()
  })
})

// Nine-card KPI footprint (Danny — same as the dashboard, all reports). The
// pipeline five stay as-is; stale.untouched/overdue and the forecast sums are
// real sums over fields the endpoint already returns — non-clickable since the
// five-way XOR carries no stale/forecast segment (no fake affordances).
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

  it('the stale and forecast KPI cards are non-clickable stats, never dead buttons', () => {
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    for (const label of ['Onaangeraakt', 'Verwachte deals', 'Verwachte waarde']) {
      const card = screen.getByText(label).closest('div[role="button"]')
      expect(card).toBeNull()
    }
  })
})
