/** ApplicationsReport · tenant custom KPI cards (split from ApplicationsReport.test.tsx; mock header duplicated per file by design). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ApplicationsReport from './ApplicationsReport'
import { data } from './ApplicationsReport.testKit'

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

// Mock useReportKpiSelection hook to return default KPI order
const mockUseReportKpiSelection = vi.fn(() => ({ data: ['total_applications', 'active_applications', 'matched_applications', 'rejected_applications', 'placed_applications', 'by_stage', 'by_function', 'by_candidate_phase', 'by_owner'] as string[], isLoading: false }))
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

// RAPPORT-GEZICHT-WAVE2: the Recharts house charts need real layout (jsdom has
// none) — stubs expose the exact click contract the real components deliver
// (donut: the datum incl. `key`; bar: the original ChartDatum). Mirrors
// CandidatesReport.test.tsx exactly.
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

// KPI-BUILDER-FE-1 slice 3: tenant-defined KPI cards ride a second band row.
describe('ApplicationsReport · tenant custom KPI cards (KPI-BUILDER-FE-1)', () => {
  afterEach(() => { getSpy.mockClear() })

  const customKpi = {
    id: 'kd-1', entity: 'application' as const, metric_key: 'new_in_period', label: 'Nieuwe sollicitaties',
    dimension: 'all', dimension_value: null, dimension_label: null, value: 14, unit: 'count' as const,
    target: 15, warn: null, comparison: 'gte' as const, status: 'alert' as const,
  }

  it('renders the tenant card with its label/value/target caption and the band title', () => {
    mockUseApplicationsReport.mockReturnValue({ data: { ...data, custom_kpis: [customKpi] }, loading: false, error: false })
    renderReport()
    expect(screen.getByText("Eigen KPI's")).toBeInTheDocument()
    expect(screen.getByText('Nieuwe sollicitaties')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText(/doel 15/)).toBeInTheDocument()
  })

  it('clicking the tenant card opens the definition drill with the accepted params only', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data: { ...data, custom_kpis: [customKpi] }, loading: false, error: false })
    renderReport()
    await user.click(screen.getByTitle('Nieuwe sollicitaties'))
    expect(getSpy).toHaveBeenCalledWith('/reports/kpi-definitions/kd-1/drill', expect.objectContaining({ params: expect.objectContaining({ period: 'month' }) }))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/kpi-definitions/kd-1/drill')
    expect(call?.[1].params).not.toHaveProperty('kpi')
    expect(call?.[1].params).not.toHaveProperty('date')
    expect(call?.[1].params).not.toHaveProperty('phase_filter')
  })

  it('renders a dash with no click for a null-value tenant card', async () => {
    const user = userEvent.setup()
    mockUseApplicationsReport.mockReturnValue({ data: { ...data, custom_kpis: [{ ...customKpi, value: null }] }, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Nieuwe sollicitaties')).toBeInTheDocument()
    await user.click(screen.getByTitle('Nieuwe sollicitaties'))
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/kpi-definitions/kd-1/drill')).toBe(false)
  })
})
