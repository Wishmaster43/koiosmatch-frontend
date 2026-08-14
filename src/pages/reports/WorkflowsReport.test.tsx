import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
const getSpy = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
}))

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

const lastDrillParams = () =>
  (getSpy.mock.calls.filter(c => c[0] === '/reports/workflows/drill').at(-1)?.[1] as { params: Record<string, unknown> }).params

describe('WorkflowsReport (RAPPORTEN-SUITE-2 workflows report)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

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
      expect(screen.getByText(label)).toBeInTheDocument()
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
    expect(lastDrillParams().status).toBe('completed')
  })

  it('clicking each plain axis drills with its own XOR param', async () => {
    const user = userEvent.setup()
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Intake-uitnodiging'))
    expect(lastDrillParams()).toEqual({ workflow: 'wf-1', period: 'month' })
    await user.click(screen.getByText('Handmatig'))
    expect(lastDrillParams()).toEqual({ trigger: 'manual', period: 'month' })
  })

  it('sends exactly one XOR param per drill call, in both directions across axes', async () => {
    const user = userEvent.setup()
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Klaar'))
    expect(lastDrillParams()).toEqual({ status: 'completed', period: 'month' })
    await user.click(screen.getByText('Intake-uitnodiging'))
    expect(lastDrillParams()).toEqual({ workflow: 'wf-1', period: 'month' })
    await user.click(screen.getByText('Klaar'))
    expect(lastDrillParams()).toEqual({ status: 'completed', period: 'month' })
  })

  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 31'))
    expect(lastDrillParams()).toEqual({ date: '2026-08-01', bucket: 'week', period: 'month' })
  })

  it('always drills via /reports/workflows/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Klaar'))
    await user.click(screen.getByText('Handmatig'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/workflows/drill' || c[0] === '/reports/workflows/advice')).toBe(true)
  })

  // Calm 403 degrade: the drill rows need settings.view on top of reports.view.
  it('keeps the advice visible when the rows request is 403-forbidden', async () => {
    const user = userEvent.setup()
    getSpy.mockImplementation((url: unknown) => String(url).endsWith('/drill')
      ? Promise.reject({ response: { status: 403 } })
      : Promise.resolve({ data: { advice: 'Controleer deze workflow.' } }))
    mockUseWorkflowsReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Klaar'))
    await waitFor(() => expect(screen.getByText('Controleer deze workflow.')).toBeInTheDocument())
    expect(screen.queryByText('Onderliggende records')).not.toBeInTheDocument()
    // No error banner text — the report's OWN error state string, not a plain-word
    // scan (both "Fout" and "Mislukt" are legitimate axis/KPI labels on this page).
    expect(screen.queryByText('Kon de workflow-runs niet laden')).not.toBeInTheDocument()
  })
})
