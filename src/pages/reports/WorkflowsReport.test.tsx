import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WorkflowsReport from './WorkflowsReport'
import type { WorkflowsReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseWorkflowsReport = vi.fn()
vi.mock('./useWorkflowsReport', () => ({ useWorkflowsReport: () => mockUseWorkflowsReport() }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
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

// Fixture per the RAPPORTEN-SUITE-2 workflows contract: three-way XOR axes,
// each axis sums to total.
const data: WorkflowsReportData = {
  period: 'month',
  from: '2026-08-01',
  to: '2026-08-31',
  total: 20,
  timeseries: { bucket: 'week', series: [
    { date: '2026-08-01', label: 'Wk 31', value: 8 },
    { date: '2026-08-10', label: 'Wk 32', value: 12 },
  ] },
  summary: { runs: 20, completed: 15, failed: 3, cancelled: 2, running: 0, success_rate: 75, avg_duration_seconds: 90 },
  by_status: [
    { value: 'completed', label: 'Klaar', color: '#16a34a', count: 15 },
    { value: 'failed', label: 'Fout', color: '#dc2626', count: 5 },
  ],
  by_workflow: [
    { value: 'wf-1', label: 'Intake-uitnodiging', count: 12 },
    { value: 'none', label: 'Geen workflow', count: 8 },
  ],
  by_trigger: [
    { value: 'manual', label: 'Handmatig', count: 9 },
    { value: 'schedule', label: 'Schema', count: 11 },
  ],
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <WorkflowsReport period="month" />
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

describe('WorkflowsReport (RAPPORTEN-SUITE-2 workflows report)', () => {
  // Every section now defaults its own list on mount, firing extra drill/advice
  // requests — clear the shared spy between tests so a later assertion never
  // matches a PRIOR test's leftover call history.
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  it('shows the loading state', () => {
    mockUseWorkflowsReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Workflow-runs laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseWorkflowsReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de workflow-runs niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no runs', () => {
    mockUseWorkflowsReport.mockReturnValue({
      data: { ...data, total: 0, by_status: [], by_workflow: [], by_trigger: [],
        timeseries: { bucket: 'week', series: [] },
        summary: { runs: 0, completed: 0, failed: 0, cancelled: 0, running: 0, success_rate: null, avg_duration_seconds: null } },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen workflow-runs in deze periode')).toBeInTheDocument()
  })

  it('renders every axis with every segment, each axis summing to the report total', () => {
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    for (const label of ['Wk 31', 'Wk 32', 'Klaar', 'Fout',
      'Intake-uitnodiging', 'Geen workflow', 'Handmatig', 'Schema']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    expect(data.by_status.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_workflow.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_trigger.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.timeseries.series.reduce((s, p) => s + p.value, 0)).toBe(data.total)
  })

  // The KPI band formats success_rate as a percentage and avg_duration_seconds
  // via the house duration formatter — never a raw seconds number.
  it('renders the run-health KPI strip, rate as % and duration formatted', () => {
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('1m 30s')).toBeInTheDocument()
    expect(screen.queryByText('90')).not.toBeInTheDocument()
  })

  // The two extra cards read distinct-category counts straight off the
  // by_workflow/by_trigger axis lengths — plain stats, never drillable.
  it('renders the workflows/triggers distinct-count cards from the axis arrays', () => {
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Aantal workflows')).toBeInTheDocument()
    expect(screen.getByText('Aantal triggers')).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2)
  })

  // REPORTS-KPI-SPARES-1: the settings-picked spare cards render real values off
  // by_workflow/by_trigger/summary already in the fixture, and the strip stays nine.
  it('renders spare KPI cards with real values when picked in settings, strip stays nine', () => {
    mockSettings.mockReturnValue({
      report_kpis_workflows: [
        'runs', 'topWorkflow', 'topTrigger', 'failureRate', 'avgRunsPerWorkflow',
        'completed', 'failed', 'cancelled', 'running',
      ],
    })
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // topWorkflow = the biggest by_workflow segment (wf-1/Intake-uitnodiging, 12).
    expect(screen.getByText('Meest actieve workflow')).toBeInTheDocument()
    expect(screen.getAllByText('Intake-uitnodiging').length).toBeGreaterThan(0)
    expect(screen.getAllByText('12').length).toBeGreaterThan(0)
    // topTrigger = the biggest by_trigger segment (schedule/Schema, 11).
    expect(screen.getByText('Meest actieve trigger')).toBeInTheDocument()
    expect(screen.getAllByText('Schema').length).toBeGreaterThan(0)
    expect(screen.getAllByText('11').length).toBeGreaterThan(0)
    // failureRate = failed (3) / runs (20) = 15%.
    expect(screen.getByText('Mislukpercentage')).toBeInTheDocument()
    expect(screen.getByText('15%')).toBeInTheDocument()
    // avgRunsPerWorkflow = runs (20) / distinct workflows (2) = 10.
    expect(screen.getByText('Gem. uitvoeringen per workflow')).toBeInTheDocument()
    expect(screen.getAllByText('10').length).toBeGreaterThan(0)
  })

  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Workflow-runs 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  it('clicking a status bar drills with status=<value> (drill + advice)', async () => {
    const user = userEvent.setup()
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Klaar'))
    expect(getSpy).toHaveBeenCalledWith('/reports/workflows/drill',
      expect.objectContaining({ params: { status: 'completed', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/workflows/advice',
      expect.objectContaining({ params: { status: 'completed', period: 'month' } }))
  })

  it('clicking each plain axis drills with its own XOR param', async () => {
    const user = userEvent.setup()
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Intake-uitnodiging'))
    expect(getSpy).toHaveBeenCalledWith('/reports/workflows/drill',
      expect.objectContaining({ params: { workflow: 'wf-1', period: 'month' } }))
    await user.click(screen.getByText('Handmatig'))
    expect(getSpy).toHaveBeenCalledWith('/reports/workflows/drill',
      expect.objectContaining({ params: { trigger: 'manual', period: 'month' } }))
  })

  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 31'))
    expect(getSpy).toHaveBeenCalledWith('/reports/workflows/drill',
      expect.objectContaining({ params: { date: '2026-08-01', bucket: 'week', period: 'month' } }))
  })

  it('always drills via /reports/workflows/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Klaar'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/workflows/drill' || c[0] === '/reports/workflows/advice')).toBe(true)
  })

  // RAPPORTEN-DRILLLIST-1: every axis section shows its own always-visible list
  // beside the chart, seeded with a real request on mount — never a blank panel.
  it('renders a drill list beside each axis chart, defaulted on mount', () => {
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // The status axis's top segment (Klaar, 15) seeds its own list on mount.
    expect(getSpy).toHaveBeenCalledWith('/reports/workflows/drill',
      expect.objectContaining({ params: { status: 'completed', period: 'month' } }))
    // The workflow axis independently seeds its own list with its own top segment.
    expect(getSpy).toHaveBeenCalledWith('/reports/workflows/drill',
      expect.objectContaining({ params: { workflow: 'wf-1', period: 'month' } }))
  })

  // Clicking a segment in one chart must never change another chart's list —
  // each axis holds its OWN drill state, never a shared overlay.
  it('clicking a segment in one chart does not change another chart\'s list', async () => {
    const user = userEvent.setup()
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('Handmatig'))
    // The trigger bar's own list is refreshed.
    expect(getSpy).toHaveBeenCalledWith('/reports/workflows/drill',
      expect.objectContaining({ params: { trigger: 'manual', period: 'month' } }))
    // The status axis was never re-requested by that click.
    expect(getSpy).not.toHaveBeenCalledWith('/reports/workflows/drill',
      expect.objectContaining({ params: expect.objectContaining({ status: 'completed' }) }))
  })
})
