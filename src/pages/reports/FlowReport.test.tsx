import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import FlowReport from './FlowReport'
import type { FlowReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseFlowReport = vi.fn()
vi.mock('./useFlowReport', () => ({ useFlowReport: () => mockUseFlowReport() }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a KPI/phase click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
}))

// Cohort-ready fixture: every phase has reached data so the real funnel (not the
// pipeline fallback) renders, with conversion_rate + avg_days_in_phase per stage.
const cohortData: FlowReportData = {
  period: 'month', from: '2026-08-01', to: '2026-08-31', total: 20,
  phases: [
    { key: 'applied', label: 'Sollicitant', current_count: 4, reached_count: 20, conversion_rate: null, avg_days_in_phase: 0 },
    { key: 'invited', label: 'Uitgenodigd', current_count: 3, reached_count: 12, conversion_rate: 0.6, avg_days_in_phase: 2 },
    { key: 'hired', label: 'Aangenomen', current_count: 2, reached_count: 6, conversion_rate: 0.5, avg_days_in_phase: 5 },
  ],
}

// Cohort-filling fixture: no stage has been reached yet, so the report falls back
// to the current_count pipeline occupancy and shows the cohortNote.
const pipelineData: FlowReportData = {
  period: 'month', from: '2026-08-01', to: '2026-08-31', total: 9,
  phases: [
    { key: 'applied', label: 'Sollicitant', current_count: 5, reached_count: 0, conversion_rate: null, avg_days_in_phase: null },
    { key: 'invited', label: 'Uitgenodigd', current_count: 4, reached_count: 0, conversion_rate: null, avg_days_in_phase: null },
  ],
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <FlowReport period="month" />
    </QueryClientProvider>,
  )
}

// The last drill/advice call's raw params — for the XOR proofs (phase present vs absent).
const lastDrillParams = () =>
  (getSpy.mock.calls.filter(c => c[0] === '/reports/flow/drill').at(-1)?.[1] as { params: Record<string, unknown> }).params
const lastAdviceParams = () =>
  (getSpy.mock.calls.filter(c => c[0] === '/reports/flow/advice').at(-1)?.[1] as { params: Record<string, unknown> }).params

describe('FlowReport', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  it('shows the loading state', () => {
    mockUseFlowReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Flow laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseFlowReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de flow niet laden')).toBeInTheDocument()
  })

  // The shared ReportStateBlock retry button must call the hook's own refetch.
  it('retries via the hook refetch when the retry button is clicked', async () => {
    const refetch = vi.fn()
    mockUseFlowReport.mockReturnValue({ data: null, loading: false, error: true, refetch })
    renderReport()
    await userEvent.click(screen.getByRole('button', { name: 'Probeer opnieuw' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state when there are no phases', () => {
    mockUseFlowReport.mockReturnValue({ data: { ...cohortData, phases: [] }, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Geen sollicitaties in deze periode')).toBeInTheDocument()
  })

  // As-rendering: every phase renders its own KPI card + funnel row (label appears
  // twice — once in the KPI strip, once in the funnel), reached_count as the value.
  it('renders every phase as a KPI card and a funnel row, plus the total and overall conversion', () => {
    mockUseFlowReport.mockReturnValue({ data: cohortData, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal sollicitaties')).toBeInTheDocument()
    expect(screen.getByText('Totale conversie')).toBeInTheDocument()
    for (const label of ['Sollicitant', 'Uitgenodigd', 'Aangenomen']) {
      expect(screen.getAllByText(label).length).toBe(2)
    }
    // Overall conversion = last reached / first reached = 6/20 = 30%.
    expect(screen.getByText('30%')).toBeInTheDocument()
    // Drop-off (cohort only) = first reached - last reached = 20 - 6 = 14; the
    // average days-in-phase card averages the non-null avg_days_in_phase values.
    expect(screen.getByText('Uitval (aantal)')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('Gem. dagen per fase')).toBeInTheDocument()
  })

  // Cohort-filling: no reached data yet, so the pipeline fallback renders (current_count)
  // and the calm cohort-filling note shows.
  it('falls back to the pipeline occupancy and shows the cohort note while the cohort fills', () => {
    mockUseFlowReport.mockReturnValue({ data: pipelineData, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Cohort vult zich nog. Pipeline-bezetting getoond tot er genoeg historie is.')).toBeInTheDocument()
    // No overall conversion KPI while the cohort isn't ready.
    expect(screen.queryByText('Totale conversie')).not.toBeInTheDocument()
  })

  // Clicking the total KPI drills with view=reached and no phase param.
  it('clicking the total KPI drills with view=reached and no phase param', async () => {
    const user = userEvent.setup()
    mockUseFlowReport.mockReturnValue({ data: cohortData, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Totaal sollicitaties'))
    expect(lastDrillParams()).toEqual({ period: 'month', view: 'reached' })
    expect(lastAdviceParams()).toEqual({ period: 'month', view: 'reached' })
  })

  // Clicking a phase KPI drills with phase=<key> + view=reached (XOR — the total
  // never carries a phase param, a phase click always does).
  it('clicking a phase KPI drills with phase=<key> and view=reached', async () => {
    const user = userEvent.setup()
    mockUseFlowReport.mockReturnValue({ data: cohortData, loading: false, error: false })
    renderReport()
    // First occurrence of the label = the KPI card (rendered before the funnel rows).
    await user.click(screen.getAllByText('Uitgenodigd')[0])
    expect(lastDrillParams()).toEqual({ phase: 'invited', period: 'month', view: 'reached' })
    expect(lastAdviceParams()).toEqual({ phase: 'invited', period: 'month', view: 'reached' })
  })

  // Clicking the funnel row itself (not just the KPI card) fires the same drill.
  it('clicking a funnel row drills the same as its KPI card', async () => {
    const user = userEvent.setup()
    mockUseFlowReport.mockReturnValue({ data: cohortData, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Aangenomen')[1])
    expect(lastDrillParams()).toEqual({ phase: 'hired', period: 'month', view: 'reached' })
  })

  // While the cohort is filling, phase drills carry view=current instead of view=reached.
  it('drills with view=current while the cohort is still filling', async () => {
    const user = userEvent.setup()
    mockUseFlowReport.mockReturnValue({ data: pipelineData, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Sollicitant')[0])
    expect(lastDrillParams()).toEqual({ phase: 'applied', period: 'month', view: 'current' })
  })

  // Every drill source targets the ONE flow drill/advice pair.
  it('always drills via /reports/flow/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseFlowReport.mockReturnValue({ data: cohortData, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Totaal sollicitaties'))
    await user.click(screen.getAllByText('Uitgenodigd')[0])
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/flow/drill' || c[0] === '/reports/flow/advice')).toBe(true)
  })
})
