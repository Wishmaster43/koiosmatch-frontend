/** VacanciesReport · tenant custom KPI cards (split from VacanciesReport.test.tsx; mock header duplicated per file by design). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import VacanciesReport from './VacanciesReport'
import { data } from './VacanciesReport.testKit'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseVacanciesReport = vi.fn()
vi.mock('./useVacanciesReport', () => ({ useVacanciesReport: (...args: unknown[]) => mockUseVacanciesReport(...args) }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket/row click sends — mutation tests must
// assert the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// Mock useReportKpiSelection hook to return default KPI order
const mockUseReportKpiSelection = vi.fn(() => ({ data: ['status', 'lead_source', 'region', 'required_function', 'contract_form', 'language', 'level', 'experience', 'no_cv'] as string[], isLoading: false }))
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
      <VacanciesReport period="month" />
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
// CandidatesReport.test.tsx's stub 1:1.
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
describe('VacanciesReport · tenant custom KPI cards (KPI-BUILDER-FE-1)', () => {
  beforeEach(() => { getSpy.mockClear() })
  const customKpi = {
    id: 'kd-2', entity: 'vacancy' as const, metric_key: 'fill_rate', label: 'Eigen bezettingsgraad',
    dimension: 'all', dimension_value: null, dimension_label: null, value: 62, unit: 'percent' as const,
    target: 70, warn: null, comparison: 'gte' as const, status: 'warn' as const,
  }

  it('renders the tenant card with its label/value/target caption and the band title', () => {
    mockUseVacanciesReport.mockReturnValue({ data: { ...data, custom_kpis: [customKpi] }, loading: false, error: false })
    renderReport()
    expect(screen.getByText("Eigen KPI's")).toBeInTheDocument()
    expect(screen.getByText('Eigen bezettingsgraad')).toBeInTheDocument()
    expect(screen.getByText(/doel 70/)).toBeInTheDocument()
  })

  it('clicking the tenant card opens the definition drill with the accepted params only', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data: { ...data, custom_kpis: [customKpi] }, loading: false, error: false })
    renderReport()
    await user.click(screen.getByTitle('Eigen bezettingsgraad'))
    expect(getSpy).toHaveBeenCalledWith('/reports/kpi-definitions/kd-2/drill', expect.objectContaining({ params: expect.objectContaining({ period: 'month' }) }))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/kpi-definitions/kd-2/drill')
    expect(call?.[1].params).not.toHaveProperty('kpi')
    expect(call?.[1].params).not.toHaveProperty('date')
  })

  it('renders a dash with no click for a null-value tenant card', async () => {
    const user = userEvent.setup()
    mockUseVacanciesReport.mockReturnValue({ data: { ...data, custom_kpis: [{ ...customKpi, value: null }] }, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Eigen bezettingsgraad')).toBeInTheDocument()
    await user.click(screen.getByTitle('Eigen bezettingsgraad'))
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/kpi-definitions/kd-2/drill')).toBe(false)
  })
})
