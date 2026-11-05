/** OutreachReport · panel filters reach hook and drill (split from OutreachReport.test.tsx). */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import OutreachReport from './OutreachReport'
import i18n from '@/i18n'
import { EMPTY_REPORT_FILTERS } from './reportFilterParams'
import { data, suiteKpis } from './OutreachReport.testKit'


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

// RAPPORT-FILTERS-2: the panel filters reach the hook AND every drill (kpi card here).
describe('OutreachReport · panel filters reach hook and drill', () => {
  it('sends the active panel filters to BOTH the report hook and a kpi drill click', async () => {
    const user = userEvent.setup()
    const filters = { ...EMPTY_REPORT_FILTERS, status: ['todo'], ownerId: ['u1'], locationId: ['l1'] }
    mockUseOutreachReport.mockReturnValue({ data: { ...data, kpis: suiteKpis }, loading: false, error: false })
    render(<QueryClientProvider client={new QueryClient()}><OutreachReport period="month" filters={filters} /></QueryClientProvider>)
    expect(mockUseOutreachReport).toHaveBeenCalledWith('month', filters)
    await user.click(screen.getByText(i18n.t('outreach.kpi.conversionPct', { ns: 'analytics' })))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/kpis/drill', expect.objectContaining({
      params: expect.objectContaining({ kpi: 'conversion_pct', period: 'month', status: ['todo'], owner_id: ['u1'], location_id: ['l1'] }),
    }))
  })
})
