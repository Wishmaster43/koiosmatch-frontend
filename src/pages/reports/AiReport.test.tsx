import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AiReport from './AiReport'
import type { AiReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseAiReport = vi.fn()
vi.mock('./useAiReport', () => ({ useAiReport: () => mockUseAiReport() }))

// Spy on the underlying axios client. This report has NO drill endpoint at all —
// the spy exists only to PROVE no request is ever made from a bar click.
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

// Fixture per the RAPPORTEN-SUITE-2 ai contract: axes carry {value,label,count}
// (+ amount/tokens where present), each axis sums to total. No cost/margin key.
const data: AiReportData = {
  period: 'month',
  from: '2026-08-01',
  to: '2026-08-31',
  total: 30,
  timeseries: { bucket: 'week', series: [
    { date: '2026-08-01', label: 'Wk 31', value: 14 },
    { date: '2026-08-10', label: 'Wk 32', value: 16 },
  ] },
  summary: { total: 30, tokens: 125000, amount: 42.5 },
  by_activity: [
    { value: 'match_suggestion', label: 'Matchvoorstel', count: 18 },
    { value: 'summary', label: 'Samenvatting', count: 12 },
  ],
  by_model: [
    { value: 'claude-sonnet', label: 'Claude Sonnet', count: 20, tokens: 80000 },
    { value: 'claude-haiku', label: 'Claude Haiku', count: 10, tokens: 45000 },
  ],
  by_user: [
    { value: 'user-1', label: 'Jan Jansen', count: 22 },
    { value: 'none', label: 'Onbekend', count: 8 },
  ],
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <AiReport period="month" />
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

describe('AiReport (RAPPORTEN-SUITE-2 ai report — no drill endpoint)', () => {
  beforeEach(() => { getSpy.mockReset() })

  it('shows the loading state', () => {
    mockUseAiReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('AI-activiteit laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseAiReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de AI-activiteit niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there is no activity', () => {
    mockUseAiReport.mockReturnValue({
      data: { ...data, total: 0, by_activity: [], by_model: [], by_user: [],
        timeseries: { bucket: 'week', series: [] },
        summary: { total: 0, tokens: null, amount: null } },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen AI-activiteit in deze periode')).toBeInTheDocument()
  })

  it('renders every axis with every segment, each axis summing to the report total', () => {
    mockUseAiReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    for (const label of ['Wk 31', 'Wk 32', 'Samenvatting',
      'Claude Sonnet', 'Claude Haiku', 'Jan Jansen', 'Onbekend']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    // 'Matchvoorstel' is also the top-activity KPI card's sub-label (it has the
    // highest count), so it legitimately renders twice — as a bar AND a KPI sub.
    expect(screen.getAllByText('Matchvoorstel').length).toBe(2)
    expect(data.by_activity.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_model.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_user.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.timeseries.series.reduce((s, p) => s + p.value, 0)).toBe(data.total)
  })

  it('renders nine honest KPI cards, all derived from summary/axes fields (sales amount only)', () => {
    mockUseAiReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal AI-activiteit')).toBeInTheDocument()
    expect(screen.getByText('Gebruikte tokens')).toBeInTheDocument()
    expect(screen.getByText('Verkoopbedrag')).toBeInTheDocument()
    expect(screen.getByText('Gem. tokens per run')).toBeInTheDocument()
    expect(screen.getByText('Gem. verkoopbedrag per run')).toBeInTheDocument()
    expect(screen.getByText('Soorten activiteit')).toBeInTheDocument()
    expect(screen.getByText('Gebruikte modellen')).toBeInTheDocument()
    expect(screen.getByText('Actieve gebruikers')).toBeInTheDocument()
    expect(screen.getByText('Meest gebruikte activiteit')).toBeInTheDocument()
    // Distinct-count cards read straight off the axis array lengths (2 activities,
    // 2 models, 2 users in the fixture) — never a hardcoded/invented number.
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(3)
    // Top-activity card shows the highest-count segment's own label + count
    // (18 appears both as the KPI value and the axis bar's own count).
    expect(screen.getAllByText('18').length).toBeGreaterThanOrEqual(1)
  })

  // REPORTS-KPI-SPARES-1: the settings-picked spare cards render real values off
  // by_model/by_user/total already in the fixture, and the strip stays nine.
  it('renders spare KPI cards with real values when picked in settings, strip stays nine', () => {
    mockSettings.mockReturnValue({
      report_kpis_ai: [
        'total', 'topModel', 'topUser', 'avgPerUser', 'avgPerActivityType',
        'tokens', 'amount', 'activityTypes', 'modelsUsed',
      ],
    })
    mockUseAiReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // topModel = the biggest by_model segment (claude-sonnet, 20).
    expect(screen.getByText('Meest gebruikte model')).toBeInTheDocument()
    expect(screen.getAllByText('Claude Sonnet').length).toBeGreaterThan(0)
    expect(screen.getAllByText('20').length).toBeGreaterThan(0)
    // topUser = the biggest by_user segment (user-1/Jan Jansen, 22).
    expect(screen.getByText('Meest actieve gebruiker')).toBeInTheDocument()
    expect(screen.getAllByText('Jan Jansen').length).toBeGreaterThan(0)
    expect(screen.getAllByText('22').length).toBeGreaterThan(0)
    // avgPerUser = total (30) / distinct users (2) = 15; avgPerActivityType = 30/2 = 15.
    expect(screen.getByText('Gem. activiteit per gebruiker')).toBeInTheDocument()
    expect(screen.getByText('Gem. activiteit per soort')).toBeInTheDocument()
    expect(screen.getAllByText('15').length).toBeGreaterThanOrEqual(2)
    mockSettings.mockReturnValue({})
  })

  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseAiReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('AI-activiteit 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  // No drill endpoint exists for this report: every bar must render as a plain,
  // non-interactive row — no button role, no tabIndex, no cursor affordance.
  it('renders axis bars with NO button role and NO keyboard focus', () => {
    mockUseAiReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.queryAllByRole('button').filter(b => /Matchvoorstel|Claude Sonnet|Jan Jansen/.test(b.textContent ?? ''))).toHaveLength(0)
    // Two 'Matchvoorstel' nodes exist (the KPI sub-label + the axis bar) — the
    // bar is the second one in DOM order (KPI band renders above the axes).
    const row = screen.getAllByText('Matchvoorstel')[1].closest('div')
    expect(row).not.toHaveAttribute('role', 'button')
    expect(row).not.toHaveAttribute('tabindex')
  })

  // Clicking anywhere on a bar must never trigger an API call — there is no
  // /reports/ai/drill endpoint by contract.
  it('clicking any bar makes NO api call', async () => {
    const user = userEvent.setup()
    mockUseAiReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Matchvoorstel')[1])
    await user.click(screen.getByText('Claude Sonnet'))
    await user.click(screen.getByText('Jan Jansen'))
    await user.click(screen.getByText('Wk 31'))
    expect(getSpy).not.toHaveBeenCalled()
  })

  // §-line: the envelope carries sales amounts only, never a cost/margin figure —
  // this report must never render or imply one.
  it('never renders a cost or margin string anywhere on the page', () => {
    mockUseAiReport.mockReturnValue({ data, loading: false, error: false })
    const { container } = renderReport()
    const text = (container.textContent ?? '').toLowerCase()
    expect(text).not.toMatch(/cost|kosten|margin|marge|winst/i)
  })
})
