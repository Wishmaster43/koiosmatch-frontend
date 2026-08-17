import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import FlowReport from './FlowReport'
import type { FlowReportData } from '@/types/analytics'
import { getReportKpiCatalog } from './kpiCatalog'

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
  getActiveTenantId: () => 'test-tenant',
}))

// Tenant KPI-order settings, controllable per test (RAPPORT-KPI-INSTELBAAR).
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

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
    mockSettings.mockReturnValue({})
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

  // Nine-card footprint (Danny — never one card per tenant funnel stage, that
  // was the unbounded strip). Only the first and last phase get their own
  // summary card (sub-label); the middle phase's detail lives ONLY in the
  // funnel row below, exactly where the per-stage breakdown belongs.
  it('renders exactly nine fixed KPI cards, never one per funnel stage', () => {
    mockUseFlowReport.mockReturnValue({ data: cohortData, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal sollicitaties')).toBeInTheDocument()
    expect(screen.getByText('Totale conversie')).toBeInTheDocument()
    expect(screen.getByText('Instapfase')).toBeInTheDocument()
    expect(screen.getByText('Eindfase')).toBeInTheDocument()
    expect(screen.getByText('Grootste uitval')).toBeInTheDocument()
    expect(screen.getByText('Bereikte fasen')).toBeInTheDocument()
    expect(screen.getByText('Fasen in trechter')).toBeInTheDocument()
    // Entry/final stage cards carry the real stage label as their sub-text,
    // plus the funnel row below. 'Sollicitant' is also the biggest-drop-off
    // stage (applied→invited = 8, the largest step), so its sub-text shows a
    // third time on the maxDropPhase card.
    expect(screen.getAllByText('Sollicitant').length).toBe(3)
    expect(screen.getAllByText('Aangenomen').length).toBe(2)
    // The middle phase has NO KPI card of its own — only the funnel row.
    expect(screen.getAllByText('Uitgenodigd').length).toBe(1)
    // Overall conversion = last reached / first reached = 6/20 = 30%.
    expect(screen.getByText('30%')).toBeInTheDocument()
    // Drop-off (cohort only) = first reached - last reached = 20 - 6 = 14; the
    // average days-in-phase card averages the non-null avg_days_in_phase values.
    expect(screen.getByText('Uitval (aantal)')).toBeInTheDocument()
    expect(screen.getAllByText('14').length).toBeGreaterThan(0)
    expect(screen.getByText('Gem. dagen per fase')).toBeInTheDocument()
    // Biggest drop-off: applied(20) → invited(12) = 8, bigger than invited(12) → hired(6) = 6.
    expect(screen.getAllByText('8').length).toBeGreaterThan(0)
    // 3 phases configured, all 3 reached (cohort ready, every reached_count > 0).
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
  })

  // Nine-card footprint holds for a tenant with a different funnel length too —
  // this is the regression that mattered: an unbounded strip grew with the
  // tenant's own stage count, this fixed one does not.
  it('still ships exactly nine cards for a five-stage tenant funnel', () => {
    const fiveStage: FlowReportData = {
      period: 'month', from: '2026-08-01', to: '2026-08-31', total: 30,
      phases: [
        { key: 'a', label: 'A', current_count: 1, reached_count: 30, conversion_rate: null, avg_days_in_phase: 1 },
        { key: 'b', label: 'B', current_count: 1, reached_count: 22, conversion_rate: 0.73, avg_days_in_phase: 2 },
        { key: 'c', label: 'C', current_count: 1, reached_count: 15, conversion_rate: 0.68, avg_days_in_phase: 3 },
        { key: 'd', label: 'D', current_count: 1, reached_count: 9, conversion_rate: 0.6, avg_days_in_phase: 4 },
        { key: 'e', label: 'E', current_count: 1, reached_count: 4, conversion_rate: 0.44, avg_days_in_phase: 5 },
      ],
    }
    mockUseFlowReport.mockReturnValue({ data: fiveStage, loading: false, error: false })
    renderReport()
    // Still exactly the same nine fixed labels, never a card for stage B/C/D.
    for (const label of ['Instapfase', 'Eindfase', 'Grootste uitval', 'Bereikte fasen', 'Fasen in trechter']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // C and D only appear once each (funnel row), never as their own KPI card.
    for (const label of ['C', 'D']) expect(screen.getAllByText(label).length).toBe(1)
    // A is both the entry stage AND the biggest-drop-off stage (a→b = 8, the
    // largest step), so its sub-text renders on two cards plus the funnel row.
    expect(screen.getAllByText('A').length).toBe(3)
    // B only appears once (funnel row) — no KPI card of its own.
    expect(screen.getAllByText('B').length).toBe(1)
    expect(screen.getAllByText('E').length).toBe(2)
  })

  // Cohort-filling: no reached data yet, so the pipeline fallback renders (current_count)
  // and the calm cohort-filling note shows; the derived-summary cards fall back to
  // the house dash instead of disappearing (still nine cards).
  it('falls back to the pipeline occupancy and shows the cohort note while the cohort fills', () => {
    mockUseFlowReport.mockReturnValue({ data: pipelineData, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Cohort vult zich nog. Pipeline-bezetting getoond tot er genoeg historie is.')).toBeInTheDocument()
    // No overall conversion number while the cohort isn't ready — the card stays,
    // dash-filled, never a fabricated percentage.
    expect(screen.getByText('Totale conversie')).toBeInTheDocument()
    expect(screen.getByText('Grootste uitval')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
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

  // Clicking a phase drills with phase=<key> + view=reached (XOR — the total
  // never carries a phase param, a phase click always does). The middle phase
  // has no KPI card of its own (nine-card cap) — this proves its funnel ROW
  // is still independently clickable.
  it('clicking a phase (via its funnel row) drills with phase=<key> and view=reached', async () => {
    const user = userEvent.setup()
    mockUseFlowReport.mockReturnValue({ data: cohortData, loading: false, error: false })
    renderReport()
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

  // ReportChartWithDrillList adoption: the inline right-hand list panel is never
  // blank on load — it defaults to the first phase, exactly as if that phase's
  // own bar had been clicked, and no client-side guess sneaks in.
  it('the right-hand list defaults to the first phase on load, real rowsEndpoint request', async () => {
    mockUseFlowReport.mockReturnValue({ data: cohortData, loading: false, error: false })
    renderReport()
    await screen.findByText('drill.records', { exact: false }).catch(() => {})
    expect(lastDrillParams()).toEqual({ phase: 'applied', period: 'month', view: 'reached' })
  })

  // Clicking a later phase replaces the list content by re-requesting with the
  // new phase key — never merging/guessing client-side.
  it('clicking a different phase re-requests the list for that phase only', async () => {
    const user = userEvent.setup()
    mockUseFlowReport.mockReturnValue({ data: cohortData, loading: false, error: false })
    renderReport()
    // Default load selects "applied" first.
    expect(lastDrillParams()).toEqual({ phase: 'applied', period: 'month', view: 'reached' })
    await user.click(screen.getAllByText('Aangenomen')[0])
    expect(lastDrillParams()).toEqual({ phase: 'hired', period: 'month', view: 'reached' })
  })

  // REPORTS-KPI-SPARE-3: the settings catalogue offers real spares beyond the
  // nine default cards — otherwise the picker has nothing new to swap in.
  it('offers worstConversionPhase/slowestPhase/dropOffRate/stagesEmpty spares in the flow catalogue', () => {
    const keys = getReportKpiCatalog('flow').map(c => c.key)
    expect(keys).toEqual(expect.arrayContaining(['worstConversionPhase', 'slowestPhase', 'dropOffRate', 'stagesEmpty']))
  })

  // Swapping in a spare renders a real, fixture-derived value — never a
  // fabricated number — and the strip still ships exactly nine cards.
  it('swapping in the four spares renders their real derived values, still nine cards', () => {
    mockSettings.mockReturnValue({
      report_kpis_flow: JSON.stringify([
        'total', 'worstConversionPhase', 'slowestPhase', 'dropOffRate', 'stagesEmpty',
        'firstPhase', 'lastPhase', 'stagesReached', 'stagesTotal',
      ]),
    })
    mockUseFlowReport.mockReturnValue({ data: cohortData, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Zwakste conversie')).toBeInTheDocument()
    // Hired has the lowest real conversion_rate (0.5, vs invited's 0.6) — also
    // shown a second time in the funnel row's own conversion column below.
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0)
    expect(screen.getByText('Traagste fase')).toBeInTheDocument()
    // Hired also has the highest real avg_days_in_phase (5) — also shown a
    // second time in the funnel row's own avg-days column below.
    expect(screen.getAllByText('gem. 5 dagen').length).toBeGreaterThan(0)
    expect(screen.getByText('Uitval (percentage)')).toBeInTheDocument()
    // dropOff (14) / first reached (20) = 70%.
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('Fasen zonder activiteit')).toBeInTheDocument()
    // All 3 configured phases were reached this window, so 0 stages sit empty.
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  // Clicking the worstConversionPhase spare drills through the SAME real phase
  // as clicking its own funnel row — never a synthetic param.
  it('clicking the worstConversionPhase spare card drills with the real phase key', async () => {
    const user = userEvent.setup()
    mockSettings.mockReturnValue({
      report_kpis_flow: JSON.stringify([
        'total', 'worstConversionPhase', 'slowestPhase', 'dropOffRate', 'stagesEmpty',
        'firstPhase', 'lastPhase', 'stagesReached', 'stagesTotal',
      ]),
    })
    mockUseFlowReport.mockReturnValue({ data: cohortData, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Zwakste conversie'))
    expect(lastDrillParams()).toEqual({ phase: 'hired', period: 'month', view: 'reached' })
  })
})
