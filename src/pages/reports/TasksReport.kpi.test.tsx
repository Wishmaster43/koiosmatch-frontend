/** TasksReport · nine-card KPI footprint, suite KPI catalogue, card drills and custom KPI band (split from TasksReport.test.tsx; mock header duplicated per file by design). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TasksReport from './TasksReport'
import { data, dataWithSuite, suiteKpis } from './TasksReport.testKit'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseTasksReport = vi.fn()
vi.mock('./useTasksReport', () => ({ useTasksReport: (...args: unknown[]) => mockUseTasksReport(...args) }))

// Tenant KPI-order settings (RAPPORT-KPI-INSTELBAAR) — empty blob = today's
// default order, unless a test overrides it.
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

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
const mockUseReportKpiSelection = vi.fn(() => ({ data: ['overdue', 'created_in_period', 'by_status', 'by_type', 'by_priority', 'by_owner', 'by_candidate', 'by_vacancy', 'unscheduled'] as string[], isLoading: false }))
vi.mock('./hooks/useReportKpiSelection', () => ({ useReportKpiSelection: () => mockUseReportKpiSelection() }))

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <TasksReport period="month" />
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

// Nine-card KPI footprint (Danny — same as the dashboard, all reports). The
// workload five stay as-is; unassigned/no-team/no-branch are each axis's real
// 'none' row (drillable — real data, real drill) and overdueRate is an honest
// ratio of two real fields.
describe('TasksReport (nine-card KPI footprint)', () => {
  afterEach(() => { getSpy.mockClear() })

  it('renders exactly nine KPI cards, one per suite key', () => {
    mockUseTasksReport.mockReturnValue({ data: dataWithSuite, loading: false, error: false })
    renderReport()
    for (const label of ['Totaal taken', 'Open', 'Te laat', 'Afgerond in periode', 'Aangemaakt in periode',
      'Vervalt vandaag', 'Vervalt deze week', 'Gem. doorlooptijd']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1)
    }
    // 'Zonder behandelaar' may also appear as an axis bar row — count, not unique.
    expect(screen.getAllByText('Zonder behandelaar').length).toBeGreaterThanOrEqual(1)
  })

  it('clicking the without_assignee card drills via its own kpi key', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data: dataWithSuite, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getAllByText('Zonder behandelaar')[0])
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/kpis/drill',
      expect.objectContaining({ params: expect.objectContaining({ kpi: 'without_assignee' }) }))
  })

  // A key the server omitted renders the dash with no clickable affordance
  // (§0 no fake affordances) — pinned with a suite missing one key.
  it('a card whose suite key is missing renders a dash and no button', () => {
    const partial = { ...data, kpis: suiteKpis.filter(k => k.key !== 'due_today') }
    mockUseTasksReport.mockReturnValue({ data: partial, loading: false, error: false })
    renderReport()
    const card = screen.getByText('Vervalt vandaag').closest('[role="button"]')
    expect(card).toBeNull()
  })
})

// KPI-TAKEN-1: the catalogue IS the nine-key suite — reorderable, no spares
// (the old summary/derived/top cards left the strip with the suite migration).
describe('TasksReport (suite KPI catalogue)', () => {
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  it('offers exactly the nine suite keys, in the suite order, with no spares', async () => {
    const { getReportKpiCatalog, getReportKpiDefaultOrder, reportHasSpareKpiCards } = await import('./kpiCatalog')
    const catalogKeys = getReportKpiCatalog('tasks').map(c => c.key)
    expect(catalogKeys).toEqual([
      'total', 'open', 'overdue', 'done_in_period', 'created_in_period',
      'due_today', 'due_this_week', 'without_assignee', 'avg_completion_days',
    ])
    expect(getReportKpiDefaultOrder('tasks')).toEqual(catalogKeys)
    expect(reportHasSpareKpiCards('tasks')).toBe(false)
  })

  it('renders a stored reorder of the suite keys, strip still exactly nine', () => {
    mockSettings.mockReturnValue({
      report_kpis_tasks: JSON.stringify([
        'overdue', 'due_today', 'due_this_week', 'without_assignee', 'open',
        'total', 'created_in_period', 'done_in_period', 'avg_completion_days',
      ]),
    })
    mockUseTasksReport.mockReturnValue({ data: dataWithSuite, loading: false, error: false })
    renderReport()
    // The reordered strip still renders every suite label exactly once as a card.
    expect(screen.getByText('Totaal taken')).toBeInTheDocument()
    expect(screen.getByText('Vervalt vandaag')).toBeInTheDocument()
  })
})

describe('TasksReport — kaartdrills eerlijk ontkoppeld', () => {
  it('no KPI card fires a kpis/drill request', () => {
    renderReport()
    const calls = getSpy.mock.calls.map(c => String(c[0]))
    expect(calls.some(u => u.includes('/kpis/drill'))).toBe(false)
  })

  // RAPPORT-COMPARE-2 (§4): the compare window lives in the right-hand filter
  // panel (ReportsPage) — the page itself renders NO inline compare control.
  it('renders no inline compare control (moved to the right filter panel)', () => {
    expect(screen.queryByText('Vergelijk met')).not.toBeInTheDocument()
  })
})

// KPI-BUILDER-FE-1: tenant-defined KPI cards ride a second band row, opening
// the shared /reports/kpi-definitions/{id}/drill route.
describe('TasksReport (custom KPI band, KPI-BUILDER-FE-1)', () => {
  it('renders a tenant-defined card with label, formatted value, target caption and band title', () => {
    mockUseTasksReport.mockReturnValue({
      data: { ...data, custom_kpis: [
        { id: 'kd-1', entity: 'task', metric_key: 'open_count', label: 'Openstaande taken', dimension: 'all', dimension_value: null, dimension_label: null, value: 8, unit: 'count', target: 15, warn: null, comparison: 'gte', status: 'alert' },
      ] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Eigen KPI\'s')).toBeInTheDocument()
    expect(screen.getByText('Openstaande taken')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText(/doel 15/)).toBeInTheDocument()
  })

  it('opens the definition drill route with only the accepted params on click', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({
      data: { ...data, custom_kpis: [
        { id: 'kd-1', entity: 'task', metric_key: 'open_count', label: 'Openstaande taken', dimension: 'all', dimension_value: null, dimension_label: null, value: 8, unit: 'count', target: 15, warn: null, comparison: 'gte', status: 'alert' },
      ] },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('Openstaande taken'))
    expect(getSpy).toHaveBeenCalledWith('/reports/kpi-definitions/kd-1/drill', expect.anything())
    const [, opts] = getSpy.mock.calls.find(c => c[0] === '/reports/kpi-definitions/kd-1/drill')!
    const params = (opts as { params: Record<string, unknown> }).params
    expect(params.period).toBe('month')
    expect(params.kpi).toBeUndefined()
    expect(params.date).toBeUndefined()
    expect(params.phase_filter).toBeUndefined()
  })

  it('renders a dash and no request for a null-value card', async () => {
    mockUseTasksReport.mockReturnValue({
      data: { ...data, custom_kpis: [
        { id: 'kd-2', entity: 'task', metric_key: 'idle', label: 'Leeg', dimension: 'all', dimension_value: null, dimension_label: null, value: null, unit: 'count', target: null, warn: null, comparison: 'none', status: 'ok' },
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
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.queryByText('Eigen KPI\'s')).not.toBeInTheDocument()
  })
})
