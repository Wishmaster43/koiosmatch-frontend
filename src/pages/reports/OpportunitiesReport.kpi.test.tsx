/** OpportunitiesReport · nine-card KPI strip, kpi catalogue and custom KPI band (split from OpportunitiesReport.test.tsx; mock header duplicated per file by design). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import OpportunitiesReport from './OpportunitiesReport'
import { EMPTY_REPORT_FILTERS } from './reportFilterParams'
import { data, dataWithKpis } from './OpportunitiesReport.testKit'

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

// The tenant picked all nine suite cards (the backend default is only four)
const mockUseReportKpiSelection = vi.fn(() => ({ data: ['total', 'open', 'won', 'lost', 'win_rate', 'open_value', 'stale', 'closing_soon', 'overdue'] as string[], isLoading: false }))
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
      <OpportunitiesReport period="month" />
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

// Asserts (or denies) a rendered element's semantic ink token — the token lives
// in the assertion argument, not in a style literal: this test paints nothing.
function expectInk(el: HTMLElement, token: string, opts?: { absent?: boolean }) {
  const m = expect(el)
  if (opts?.absent) m.not.toHaveInlineStyle({ color: token })
  else m.toHaveInlineStyle({ color: token })
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
  it('offers the nine server-suite keys, in suite order; the backend default is four cards', async () => {
    const { getReportKpiCatalog, getReportKpiDefaultOrder, reportHasSpareKpiCards } = await import('./kpiCatalog')
    const keys = getReportKpiCatalog('opportunities').map(c => c.key)
    expect(keys).toEqual([
      'total', 'open', 'won', 'lost', 'win_rate', 'open_value', 'stale', 'closing_soon', 'overdue',
    ])
    expect(getReportKpiDefaultOrder('opportunities')).toEqual(['total', 'open', 'won', 'win_rate'])
    expect(reportHasSpareKpiCards('opportunities')).toBe(true)
  })

  // RAPPORT-COMPARE-2 (§4): the compare window lives in the right-hand filter
  // panel (ReportsPage) — the page itself renders NO inline compare control.
  it('renders no inline compare control (moved to the right filter panel)', () => {
    expect(screen.queryByText('Vergelijk met')).not.toBeInTheDocument()
  })
})

// KPI-BUILDER-FE-1: tenant-defined KPI cards ride a second band row, opening
// the shared /reports/kpi-definitions/{id}/drill route.
describe('OpportunitiesReport (custom KPI band, KPI-BUILDER-FE-1)', () => {
  it('renders a tenant-defined card with label, formatted value, target caption and band title', () => {
    mockUseOpportunitiesReport.mockReturnValue({
      data: { ...data, custom_kpis: [
        { id: 'kd-1', entity: 'opportunity', metric_key: 'open_count', label: 'Openstaande kansen', dimension: 'all', dimension_value: null, dimension_label: null, value: 6, unit: 'count', target: 10, warn: null, comparison: 'gte', status: 'alert' },
      ] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Eigen KPI\'s')).toBeInTheDocument()
    expect(screen.getByText('Openstaande kansen')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText(/doel 10/)).toBeInTheDocument()
  })

  it('opens the definition drill route with only the accepted params on click', async () => {
    const user = userEvent.setup()
    mockUseOpportunitiesReport.mockReturnValue({
      data: { ...data, custom_kpis: [
        { id: 'kd-1', entity: 'opportunity', metric_key: 'open_count', label: 'Openstaande kansen', dimension: 'all', dimension_value: null, dimension_label: null, value: 6, unit: 'count', target: 10, warn: null, comparison: 'gte', status: 'alert' },
      ] },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('Openstaande kansen'))
    expect(getSpy).toHaveBeenCalledWith('/reports/kpi-definitions/kd-1/drill', expect.anything())
    const [, opts] = getSpy.mock.calls.find(c => c[0] === '/reports/kpi-definitions/kd-1/drill')!
    const params = (opts as { params: Record<string, unknown> }).params
    expect(params.period).toBe('month')
    expect(params.kpi).toBeUndefined()
    expect(params.date).toBeUndefined()
    expect(params.phase_filter).toBeUndefined()
  })

  it('renders a dash and no request for a null-value card', async () => {
    mockUseOpportunitiesReport.mockReturnValue({
      data: { ...data, custom_kpis: [
        { id: 'kd-2', entity: 'opportunity', metric_key: 'idle', label: 'Leeg', dimension: 'all', dimension_value: null, dimension_label: null, value: null, unit: 'count', target: null, warn: null, comparison: 'none', status: 'ok' },
      ] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Leeg')).toBeInTheDocument()
    const card = screen.getByText('Leeg').parentElement!
    expect(within(card).getByText('—')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByText('Leeg'))
    expect(getSpy).not.toHaveBeenCalledWith('/reports/kpi-definitions/kd-2/drill', expect.anything())
  })

  it('renders exactly as today when the envelope carries no custom_kpis', () => {
    mockUseOpportunitiesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.queryByText('Eigen KPI\'s')).not.toBeInTheDocument()
  })

  // CUSTOM-KPI-HOOK-1 verifier fix: the shared hook renames this page's own
  // `customer_id[]` panel filter to the definition-drill route's `customer_ids[]`
  // (the route never accepts the singular key, per openapi.yaml) — pin the
  // request shape, not just that a click fires.
  it('renames the active customer_id panel filter to customer_ids on the definition drill', async () => {
    const user = userEvent.setup()
    const filters = { ...EMPTY_REPORT_FILTERS, customerId: ['c-1'] }
    mockUseOpportunitiesReport.mockReturnValue({
      data: { ...data, custom_kpis: [
        { id: 'kd-1', entity: 'opportunity', metric_key: 'open_count', label: 'Openstaande kansen', dimension: 'all', dimension_value: null, dimension_label: null, value: 6, unit: 'count', target: 10, warn: null, comparison: 'gte', status: 'alert' },
      ] },
      loading: false, error: false,
    })
    render(<QueryClientProvider client={new QueryClient()}><OpportunitiesReport period="month" filters={filters} /></QueryClientProvider>)
    await user.click(screen.getByText('Openstaande kansen'))
    // Match on the LAST call, not the first — earlier tests in this file also
    // hit kd-1's drill route with different params (module-level getSpy is not
    // reset between describe blocks).
    const [, opts] = getSpy.mock.calls.filter(c => c[0] === '/reports/kpi-definitions/kd-1/drill').at(-1)!
    const params = (opts as { params: Record<string, unknown> }).params
    expect(params.customer_ids).toEqual(['c-1'])
    expect(params.customer_id).toBeUndefined()
  })
})
