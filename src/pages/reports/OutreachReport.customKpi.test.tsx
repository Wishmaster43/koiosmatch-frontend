/** OutreachReport · custom KPI band (split from OutreachReport.test.tsx; KPI-BUILDER-FE-1). */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import OutreachReport from './OutreachReport'
import { data } from './OutreachReport.testKit'


// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseOutreachReport = vi.fn()
vi.mock('./useOutreachReport', () => ({ useOutreachReport: (...args: unknown[]) => mockUseOutreachReport(...args) }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// Mock useReportKpiSelection hook to return default KPI order
const mockUseReportKpiSelection = vi.fn(() => ({ data: ['called_in_period', 'by_outcome', 'by_source', 'by_campaign', 'by_owner', 'by_function', 'by_candidate_phase', 'unscheduled_appointments', 'scheduled_appointments'] as string[], isLoading: false }))
vi.mock('./hooks/useReportKpiSelection', () => ({ useReportKpiSelection: () => mockUseReportKpiSelection() }))

// Tenant KPI-order settings (RAPPORT-KPI-INSTELBAAR) — empty blob = today's
// default axis order, unless a test overrides it.
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <OutreachReport period="month" />
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
// WeeklyBarChartCard backs the depth 'channel funnel' bar chart — same stub
// idiom, but one button per (row, series) so a series-specific click (only
// 'total' drills) can be fired directly.
type StubSeries = { key: string; label: string }
vi.mock('@/components/charts/WeeklyBarChartCard', () => ({
  default: ({ data, series, onBarClick }: { data?: StubDatum[]; series?: StubSeries[]; onBarClick?: (row: unknown, s: StubSeries) => void }) => (
    <>{(data ?? []).flatMap(d => (series ?? []).map(s => (
      <button key={`${d.key}-${s.key}`} onClick={() => onBarClick?.(d, s)}>{d.name}-{s.key}</button>
    )))}</>
  ),
}))

// KPI-BUILDER-FE-1: tenant-defined KPI cards ride a second band row, opening
// the shared /reports/kpi-definitions/{id}/drill route.
describe('OutreachReport (custom KPI band, KPI-BUILDER-FE-1)', () => {
  it('renders a tenant-defined card with label, formatted value, target caption and band title', () => {
    mockUseOutreachReport.mockReturnValue({
      data: { ...data, custom_kpis: [
        { id: 'kd-1', entity: 'outreach', metric_key: 'reached_count', label: 'Tenant bereikt', dimension: 'all', dimension_value: null, dimension_label: null, value: 40, unit: 'count', target: 60, warn: null, comparison: 'gte', status: 'alert' },
      ] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Eigen KPI\'s')).toBeInTheDocument()
    expect(screen.getByText('Tenant bereikt')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.getByText(/doel 60/)).toBeInTheDocument()
  })

  it('opens the definition drill route with only the accepted params on click', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({
      data: { ...data, custom_kpis: [
        { id: 'kd-1', entity: 'outreach', metric_key: 'reached_count', label: 'Tenant bereikt', dimension: 'all', dimension_value: null, dimension_label: null, value: 40, unit: 'count', target: 60, warn: null, comparison: 'gte', status: 'alert' },
      ] },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('Tenant bereikt'))
    expect(getSpy).toHaveBeenCalledWith('/reports/kpi-definitions/kd-1/drill', expect.anything())
    const [, opts] = getSpy.mock.calls.find(c => c[0] === '/reports/kpi-definitions/kd-1/drill')!
    const params = (opts as { params: Record<string, unknown> }).params
    expect(params.period).toBe('month')
    expect(params.kpi).toBeUndefined()
    expect(params.date).toBeUndefined()
    expect(params.phase_filter).toBeUndefined()
  })

  it('renders a dash and no request for a null-value card', async () => {
    mockUseOutreachReport.mockReturnValue({
      data: { ...data, custom_kpis: [
        { id: 'kd-2', entity: 'outreach', metric_key: 'idle', label: 'Leeg', dimension: 'all', dimension_value: null, dimension_label: null, value: null, unit: 'count', target: null, warn: null, comparison: 'none', status: 'ok' },
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
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.queryByText('Eigen KPI\'s')).not.toBeInTheDocument()
  })
})
