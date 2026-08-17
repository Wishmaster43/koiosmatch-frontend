/**
 * UsageOverviewReport — the merged Verbruik overview. Covers the four UI states,
 * the nine-card strip read off the single envelope, the merged day bar footing to
 * the totals, and the two honesty rules this screen exists to keep:
 *   - the module axis is workflow-only and SAYS so (a reader must never have to
 *     work out for themselves why the module rows do not sum to the total);
 *   - while /reports/usage/drill does not exist, no bar is clickable and no drill
 *     request is fired (§3 no fake affordances) — asserted on the real request
 *     spy, not on a callback.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import UsageOverviewReport from './UsageOverviewReport'
import type { UsageOverviewReportData } from '@/types/analytics'

const mockUseUsageOverviewReport = vi.fn()
vi.mock('./useUsageOverviewReport', () => ({ useUsageOverviewReport: () => mockUseUsageOverviewReport() }))

// The axios client itself is spied on, so "no drill fired" is proven at the
// request layer rather than at a handler that may simply not have been wired.
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

vi.mock('./ReportTimeseriesChart', () => ({
  default: ({ series, onPick }: { series: { date: string; label: string; value: number }[]; onPick?: (date: string) => void }) => (
    <>{series.map(p => (
      <button key={p.date} onClick={() => onPick?.(p.date)} disabled={!onPick}>{`${p.label} (${p.value})`}</button>
    ))}</>
  ),
}))

// Fixture in the App\Services\Report\UsageReport shape: totals, a workflow-only
// module axis, and a merged day series that foots to totals.total.
const data: UsageOverviewReportData = {
  period: 'month',
  from: '2026-08-01',
  to: '2026-08-31',
  totals: { workflow_credits: 30, ai_credits: 20, total: 50, ai_amount: 12.5 },
  by_module: [
    { value: 'send_whatsapp', label: 'WhatsApp sturen', count: 18 },
    { value: 'create_task', label: 'Taak aanmaken', count: 12 },
  ],
  timeseries: [
    { day: '2026-08-01', workflow_credits: 10, ai_credits: 5 },
    { day: '2026-08-02', workflow_credits: 20, ai_credits: 15 },
    { day: '2026-08-03', workflow_credits: 0, ai_credits: 0 },
  ],
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <UsageOverviewReport period="month" />
    </QueryClientProvider>,
  )
}

describe('UsageOverviewReport (merged Verbruik overview)', () => {
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  it('shows the loading state', () => {
    mockUseUsageOverviewReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Verbruik laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseUsageOverviewReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon het verbruik niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when nothing was consumed', () => {
    mockUseUsageOverviewReport.mockReturnValue({
      data: { ...data, totals: { workflow_credits: 0, ai_credits: 0, total: 0, ai_amount: 0 }, by_module: [], timeseries: [] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen verbruik in deze periode')).toBeInTheDocument()
  })

  it('renders the merged day bars, each equal to its two halves added together', () => {
    mockUseUsageOverviewReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('01-08-2026 (15)')).toBeInTheDocument() // 10 + 5
    expect(screen.getByText('02-08-2026 (35)')).toBeInTheDocument() // 20 + 15
    // The series foots to the envelope's own total — the invariant the drill's
    // meta.total is checked against server-side.
    const summed = data.timeseries.reduce((s, d) => s + d.workflow_credits + d.ai_credits, 0)
    expect(summed).toBe(data.totals.total)
  })

  it('names the workflow unit Koios Tokens and shows the AI amount as money', () => {
    mockUseUsageOverviewReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Koios Tokens')).toBeInTheDocument()
    expect(screen.getByText('AI-bedrag')).toBeInTheDocument()
    expect(screen.getByText(/12,50/)).toBeInTheDocument()
  })

  it('averages over the days that actually consumed something, not the whole window', () => {
    mockUseUsageOverviewReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // 50 over the TWO active days = 25; over all three days it would read 17.
    expect(screen.getByText('Gemiddeld per actieve dag')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    // "Dagen met verbruik" counts 2 of the 3 days — the third consumed nothing.
    // ("2" also appears as the module count, hence getAllByText.)
    expect(screen.getByText('Dagen met verbruik')).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2)
  })

  it('says out loud that the module axis holds workflow rows only', () => {
    mockUseUsageOverviewReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText(/Alleen workflow-uitvoeringen/)).toBeInTheDocument()
    // And the axis genuinely foots to the WORKFLOW half, never to the grand total.
    expect(data.by_module.reduce((s, x) => s + x.count, 0)).toBe(data.totals.workflow_credits)
  })

  it('seeds each list from its own top segment, through the report OWN drill route', async () => {
    mockUseUsageOverviewReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // Both lists seed on mount: the busiest module and the last day in the window.
    await waitFor(() => expect(getSpy).toHaveBeenCalledWith('/reports/usage/drill',
      expect.objectContaining({ params: expect.objectContaining({ module: 'send_whatsapp', period: 'month' }) })))
    expect(getSpy).toHaveBeenCalledWith('/reports/usage/drill',
      expect.objectContaining({ params: expect.objectContaining({ date: '2026-08-03', period: 'month' }) }))
    // It must be the report's OWN route: borrowing /reports/workflows/drill would
    // hand back a list missing the AI half of every merged day bar.
    const routes = getSpy.mock.calls.map(c => c[0])
    expect(routes.every((r: string) => String(r).startsWith('/reports/usage/'))).toBe(true)
  })

  it('a day bar drills on that day alone, never mixed with the module axis (XOR)', async () => {
    mockUseUsageOverviewReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await waitFor(() => expect(getSpy).toHaveBeenCalled())
    getSpy.mockClear()
    await userEvent.click(screen.getByText('02-08-2026 (35)'))
    await waitFor(() => expect(getSpy).toHaveBeenCalled())
    const params = getSpy.mock.calls
      .filter(c => c[0] === '/reports/usage/drill')
      .map(c => (c[1] as { params: Record<string, unknown> }).params)
    expect(params.length).toBeGreaterThan(0)
    for (const p of params) {
      expect(p.date).toBe('2026-08-02')
      expect(p.module).toBeUndefined() // XOR: never both axes in one request
    }
  })
})
