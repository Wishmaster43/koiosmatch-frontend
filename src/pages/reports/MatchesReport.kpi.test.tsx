/** MatchesReport · nine-card KPI strip, kpi catalogue and custom KPI band (split from MatchesReport.test.tsx; mock header duplicated per file by design). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MatchesReport from './MatchesReport'
import i18n from '@/i18n'
// Escapes translated copy before it becomes a RegExp matcher (copy may gain metacharacters).
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
import { data, dataWithKpis } from './MatchesReport.testKit'

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

// Mock useReportKpiSelection hook to return default KPI order
const mockUseReportKpiSelection = vi.fn(() => ({ data: ['under_contract', 'terminations', 'by_contract_form', 'by_customer', 'by_owner', 'by_function', 'by_candidate_phase', 'by_reason', 'active'] as string[], isLoading: false }))
vi.mock('./hooks/useReportKpiSelection', () => ({ useReportKpiSelection: () => mockUseReportKpiSelection() }))

// Tenant KPI-order settings, controllable per test (RAPPORT-KPI-INSTELBAAR).
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MatchesReport period="month" />
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

// RAPPORT-GEZICHT-WAVE2: the house donut needs real layout (jsdom has none) —
// stub exposes the exact click contract the real component delivers (the
// datum incl. `key`, mirroring CandidatesReport's stub).
type StubDatum = { name: string; value: number; key?: string }
vi.mock('@/components/charts/PieChartCard', () => ({
  default: ({ data, onItemClick }: { data?: StubDatum[]; onItemClick?: (d: unknown) => void }) => (
    <>{(data ?? []).map(d => <button key={d.key} onClick={() => onItemClick?.(d)}>{d.name}</button>)}</>
  ),
}))

// Asserts (or denies) a rendered element's semantic ink token — the token lives
// in the assertion argument, not in a style literal: this test paints nothing.
function expectInk(el: HTMLElement, token: string, opts?: { absent?: boolean }) {
  const m = expect(el)
  if (opts?.absent) m.not.toHaveInlineStyle({ color: token })
  else m.toHaveInlineStyle({ color: token })
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
// spares (supersedes the old REPORTS-KPI-SPARE-1 four-spare block).
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

// KPI-BUILDER-FE-1: tenant-defined KPI cards ride a second band row, opening
// the shared /reports/kpi-definitions/{id}/drill route.
describe('MatchesReport (custom KPI band, KPI-BUILDER-FE-1)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  it('renders a tenant-defined card with label, formatted value, target caption and band title', () => {
    mockUseMatchesReport.mockReturnValue({
      data: { ...data, custom_kpis: [
        { id: 'kd-1', entity: 'match', metric_key: 'new_in_period', label: 'Nieuwe matches', dimension: 'all', dimension_value: null, dimension_label: null, value: 14, unit: 'count', target: 15, warn: null, comparison: 'gte', status: 'alert' },
      ] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Eigen KPI\'s')).toBeInTheDocument()
    expect(screen.getByText('Nieuwe matches')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(escapeRegExp(i18n.t('analytics:customKpi.target', { value: 15 }))))).toBeInTheDocument()
  })

  it('opens the definition drill route with only the accepted params on click', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({
      data: { ...data, custom_kpis: [
        { id: 'kd-1', entity: 'match', metric_key: 'new_in_period', label: 'Nieuwe matches', dimension: 'all', dimension_value: null, dimension_label: null, value: 14, unit: 'count', target: 15, warn: null, comparison: 'gte', status: 'alert' },
      ] },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('Nieuwe matches'))
    expect(getSpy).toHaveBeenCalledWith('/reports/kpi-definitions/kd-1/drill', expect.anything())
    const [, opts] = getSpy.mock.calls.find(c => c[0] === '/reports/kpi-definitions/kd-1/drill')!
    const params = (opts as { params: Record<string, unknown> }).params
    expect(params.period).toBe('month')
    expect(params.kpi).toBeUndefined()
    expect(params.date).toBeUndefined()
    expect(params.phase_filter).toBeUndefined()
  })

  it('sends dimension_value for a fan-out card and shows both label parts', async () => {
    const user = userEvent.setup()
    mockUseMatchesReport.mockReturnValue({
      data: { ...data, custom_kpis: [
        { id: 'kd-2', entity: 'match', metric_key: 'match_contract_form', label: 'Nieuwe matches', dimension: 'contract_form', dimension_value: 'freelance', dimension_label: 'ZZP', value: 3, unit: 'count', target: null, warn: null, comparison: 'none', status: 'ok' },
      ] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText(i18n.t('analytics:customKpi.labelWithDimension', { label: 'Nieuwe matches', dimension: 'ZZP' }))).toBeInTheDocument()
    await user.click(screen.getByText(i18n.t('analytics:customKpi.labelWithDimension', { label: 'Nieuwe matches', dimension: 'ZZP' })))
    const [, opts] = getSpy.mock.calls.find(c => c[0] === '/reports/kpi-definitions/kd-2/drill')!
    expect((opts as { params: Record<string, unknown> }).params.dimension_value).toBe('freelance')
  })

  it('renders a dash and no request for a null-value card', async () => {
    mockUseMatchesReport.mockReturnValue({
      data: { ...data, custom_kpis: [
        { id: 'kd-3', entity: 'match', metric_key: 'idle', label: 'Leeg', dimension: 'all', dimension_value: null, dimension_label: null, value: null, unit: 'count', target: null, warn: null, comparison: 'none', status: 'ok' },
      ] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Leeg')).toBeInTheDocument()
    const card = screen.getByText('Leeg').parentElement!
    expect(within(card).getByText('—')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByText('Leeg'))
    expect(getSpy).not.toHaveBeenCalledWith('/reports/kpi-definitions/kd-3/drill', expect.anything())
  })

  it('renders exactly as today when the envelope carries no custom_kpis', () => {
    mockUseMatchesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.queryByText('Eigen KPI\'s')).not.toBeInTheDocument()
  })
})
