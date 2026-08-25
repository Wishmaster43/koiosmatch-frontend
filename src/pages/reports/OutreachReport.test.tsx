import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import OutreachReport from './OutreachReport'
import i18n from '@/i18n'
import { EMPTY_REPORT_FILTERS } from './reportFilterParams'
import type { OutreachReportData } from '@/types/analytics'

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

// Tenant KPI-order settings (RAPPORT-KPI-INSTELBAAR) — empty blob = today's
// default axis order, unless a test overrides it.
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

// Portie-6 payload: the fase-1 fields (total_targets/reached/reach_rate + legacy
// status/outcome keys) are still present; every new axis sums to `total`. The
// series has NO ghost zero-bucket — series[0].date === from.
const data: OutreachReportData = {
  period: 'month', from: '2026-05-14', to: '2026-08-14',
  total_targets: 40, reached: 25, reach_rate: 0.63, total: 40,
  timeseries: { bucket: 'week', series: [
    { date: '2026-05-14', label: 'Wk 20', value: 18 },
    { date: '2026-08-10', label: 'Wk 33', value: 22 },
  ] },
  by_status: [
    { status: 'contacted', value: 'contacted', label: 'Benaderd', count: 25 },
    { status: 'new', value: 'new', label: 'Nieuw', count: 11 },
    // Orphan-string status: its own "Onbekend" bar, drillable on the RAW value.
    { status: 'weird-legacy-status', value: 'weird-legacy-status', label: 'Onbekend', count: 4 },
  ],
  by_outcome: [
    { outcome: 'interested', value: 'interested', label: 'Interested', count: 10, share_of_reached: 0.4 },
    { outcome: 'not_interested', value: 'not_interested', label: 'Geen interesse', count: 15, share_of_reached: 0.6 },
    // The sentinel that makes the axis sum to total (targets without any outcome).
    { outcome: 'none', value: 'none', label: 'Geen uitkomst', count: 15, share_of_reached: null },
  ],
  by_campaign: [
    { value: 'camp-1', label: 'Bellijst Q3 wondzorg', count: 20 },
    // An archived campaign keeps its real name and stays drillable on its uuid.
    { value: 'camp-archived-uuid', label: 'Voorjaarsactie 2026', count: 12 },
    { value: 'others', label: 'Overige bellijsten', count: 8 },
  ],
  by_assignee: [
    { owner_id: 'u1', name: 'Anna de Vries', count: 30 },
    { owner_id: 'none', name: 'Niet toegewezen', count: 10 },
  ],
  channel_funnel: [
    { channel: 'call', total: 12, reached: 8, applied: 3, placed: 1 },
  ],
  by_channel: [
    { value: 'phone', label: 'Telefoon', count: 26 },
    { value: 'whatsapp', label: 'WhatsApp', count: 9 },
    { value: 'none', label: 'Geen kanaal', count: 5 },
  ],
}

// KPI-OUTREACH-1: the server suite the strip renders verbatim — one entry per
// drill-enum key, value and drawer sharing one backend predicate.
const suiteKpis = [
  { key: 'total_targets', count: 40 }, { key: 'open_todo', count: 12 },
  { key: 'called_in_period', count: 28 }, { key: 'reached', count: 25 },
  { key: 'not_reached', count: 15 }, { key: 'conversion_pct', count: 62.5 },
  { key: 'campaigns_active', count: 3 }, { key: 'campaigns_done_in_period', count: 1 },
  { key: 'due_today', count: 4 },
]
const dataWithSuite: OutreachReportData = { ...data, kpis: suiteKpis }

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <OutreachReport period="month" />
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

describe('OutreachReport (RAPPORTEN-SUITE-1 portie 6, bellijsten report)', () => {
  // Every section now defaults its own list on mount, firing extra drill/advice
  // requests — clear the shared spy between tests so a later assertion never
  // matches a PRIOR test's leftover call history.
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  it('shows the loading state', () => {
    mockUseOutreachReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Outreach laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseOutreachReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de outreach niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no targets', () => {
    mockUseOutreachReport.mockReturnValue({
      data: { ...data, total_targets: 0, reached: 0, reach_rate: null, total: 0,
        timeseries: { bucket: 'week', series: [] },
        by_status: [], by_outcome: [], by_campaign: [], by_assignee: [], by_channel: [] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen bellijst-targets in deze periode')).toBeInTheDocument()
  })

  // Contract: every axis (fase-1 status/outcome included) renders every segment
  // (incl. 'none'/'others'/orphan bars) and sums exactly to the report total.
  it('renders every axis with every segment, each axis summing to the report total', () => {
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // getAllByText: a few axis labels (Niet toegewezen/Telefoon/Geen uitkomst) now
    // also double as a KPI-card label or sub — presence is what this test proves.
    for (const label of ['Wk 20', 'Wk 33', 'Bellijst Q3 wondzorg', 'Voorjaarsactie 2026', 'Overige bellijsten',
      'Anna de Vries', 'Niet toegewezen', 'Telefoon', 'WhatsApp', 'Geen kanaal',
      'Benaderd', 'Nieuw', 'Onbekend', 'Interested', 'Geen interesse', 'Geen uitkomst']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    expect(data.by_status.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_outcome.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_campaign.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_assignee.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_channel.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.timeseries.series.reduce((s, p) => s + p.value, 0)).toBe(data.total)
  })

  // KPI-OUTREACH-1: the strip renders the server kpis[] suite verbatim — nine
  // translated cards, conversion_pct as a percentage, signal cards coloured
  // only when non-zero (§4: colour carries meaning).
  it('renders the nine suite cards from kpis[] with translated labels', () => {
    mockUseOutreachReport.mockReturnValue({ data: dataWithSuite, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal doelen')).toBeInTheDocument()
    expect(screen.getByText('Open te doen')).toBeInTheDocument()
    expect(screen.getByText('Gebeld in periode')).toBeInTheDocument()
    expect(screen.getByText('Bereikt')).toBeInTheDocument()
    expect(screen.getByText('Niet bereikt')).toBeInTheDocument()
    expect(screen.getByText('Actieve campagnes')).toBeInTheDocument()
    expect(screen.getByText('Campagnes afgerond in periode')).toBeInTheDocument()
    expect(screen.getByText('Vervalt vandaag')).toBeInTheDocument()
    // conversion_pct renders through the house percent formatter.
    expect(screen.getByText('62,5%')).toBeInTheDocument()
    // The non-zero reached count wears the success colour (semantic signal).
    const reachedValue = screen.getAllByText('Bereikt').at(-1)?.parentElement?.parentElement
    expect(reachedValue?.textContent).toContain('25')
  })

  // KPI-OUTREACH-1: a suite card's VALUE comes from kpis[] and its click drills
  // the SAME key — one predicate for number and drawer (§13 asserts the request).
  it('reads called_in_period from kpis[] and drills via its own kpi key', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data: dataWithSuite, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('28'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/kpis/drill',
      expect.objectContaining({ params: expect.objectContaining({ kpi: 'called_in_period', period: 'month' }) }))
  })

  // Honest fallback: a pre-suite envelope (no kpis[]) renders the house dash on
  // every card, with no drill affordance — never a value from another population.
  it('renders dashes with no drill when kpis[] is absent', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(9)
    getSpy.mockClear()
    await user.click(screen.getByText('Totaal doelen'))
    expect(getSpy).not.toHaveBeenCalledWith('/reports/outreach/kpis/drill', expect.anything())
  })

  // A missing/null kpis[] must never crash the strip.
  it('does not crash when kpis is missing', () => {
    mockUseOutreachReport.mockReturnValue({ data: { ...data, kpis: undefined }, loading: false, error: false })
    expect(() => renderReport()).not.toThrow()
  })

  // BELANGRIJK per contract: the window comes from the RESPONSE and must render
  // prominently as DD-MM-YYYY — never ISO (CLAUDE.md §3B DATUM-1).
  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Bellijst-targets 14-05-2026 t/m 14-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-05-14/)).not.toBeInTheDocument()
  })

  it('clicking a campaign bar drills with campaign=<uuid> (drill + advice)', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Bellijst Q3 wondzorg').at(-1)!)
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { campaign: 'camp-1', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/advice',
      expect.objectContaining({ params: { campaign: 'camp-1', period: 'month' } }))
  })

  // 'others' = the exact complement of the top-20 — a real, clickable row.
  it('clicking the "Overige bellijsten" bar drills with campaign=others', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Overige bellijsten'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { campaign: 'others', period: 'month' } }))
  })

  // An archived campaign keeps its real name (never "Onbekend") and its bar still
  // drills on the raw uuid like any other campaign.
  it('renders an archived campaign under its own name and drills on its uuid', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Voorjaarsactie 2026'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { campaign: 'camp-archived-uuid', period: 'month' } }))
  })

  it('clicking an assignee bar drills with the assignee XOR param (D2 shape: owner_id → assignee)', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Anna de Vries'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { assignee: 'u1', period: 'month' } }))
    await user.click(screen.getAllByText('Niet toegewezen').at(-1)!)
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { assignee: 'none', period: 'month' } }))
  })

  // DASH-FEEDS-V3 depth: the channel-funnel bar chart's onChannel seam — only
  // the 'total' series bar drills, carrying the channel value as the XOR param.
  it('clicking the channel-funnel total bar drills with the channel XOR param', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText(`${i18n.t('outreach.depth.channel.call', { ns: 'analytics' })}-total`))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { channel: 'call', period: 'month' } }))
  })

  it('clicking a channel bar drills with the channel XOR param (incl. the none sentinel)', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Telefoon').at(-1)!)
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { channel: 'phone', period: 'month' } }))
    await user.click(screen.getByText('Geen kanaal'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { channel: 'none', period: 'month' } }))
  })

  // Orphan-string status: a status value with no lookup row still renders its own
  // "Onbekend" bar and drills on the RAW value — no special-casing.
  it('clicking the status "Onbekend" orphan bar drills on its raw value', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { status: 'weird-legacy-status', period: 'month' } }))
  })

  // The "Geen uitkomst" sentinel makes by_outcome sum to total — and drills on
  // its own value like any other outcome segment.
  it('clicking the "Geen uitkomst" sentinel drills with outcome=none', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Geen uitkomst').at(-1)!)
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { outcome: 'none', period: 'month' } }))
    await user.click(screen.getByText('Interested'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { outcome: 'interested', period: 'month' } }))
  })

  // XOR both directions on two axes: switching status → campaign → status never
  // lets the previous axis' param ride along — each axis keeps its own params.
  it('keeps the drill params XOR when hopping between the status and campaign axes', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Nieuw'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { status: 'new', period: 'month' } }))
    await user.click(screen.getByText('Overige bellijsten'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { campaign: 'others', period: 'month' } }))
    // Neither call ever mixed the other axis's param onto its own.
    const statusCall = getSpy.mock.calls.find(c => c[0] === '/reports/outreach/drill'
      && (c[1] as { params: Record<string, unknown> }).params.status === 'new')
    expect(statusCall?.[1].params).not.toHaveProperty('campaign')
  })

  // GRANULARITY role of `bucket` (dual-role contract): a week timeseries bar drills
  // with date=<key> + bucket=week so bar and list totals always agree.
  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 20'))
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { date: '2026-05-14', bucket: 'week', period: 'month' } }))
  })

  it('omits bucket when the timeseries is day-granular', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({
      data: { ...data, timeseries: { bucket: 'day', series: [{ date: '2026-05-14', label: '14-05', value: 3 }] } },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('14-05'))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/outreach/drill'
      && (c[1] as { params: Record<string, unknown> }).params.date === '2026-05-14')
    expect(call?.[1].params).not.toHaveProperty('bucket')
  })

  // Every drill source targets the ONE outreach drill/advice pair — never a
  // sibling report's endpoint, never an entity list route.
  it('always drills via /reports/outreach/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Nieuw'))
    await user.click(screen.getByText('WhatsApp'))
    await user.click(screen.getAllByText('Niet toegewezen').at(-1)!)
    await user.click(screen.getByText('Wk 33'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/outreach/drill' || c[0] === '/reports/outreach/advice')).toBe(true)
  })

  // REPORTGRID-1: the shared drill drawer opens only on click, never
  // auto-defaulted on mount.
  it('never fires a drill request before any segment is clicked', () => {
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(getSpy).not.toHaveBeenCalled()
  })

  // Clicking a segment in one chart must never change another chart's list — each
  // section owns its own drill state, never a shared overlay. "Nieuw" is NOT the
  // status axis's mount default (Benaderd/contacted is), so this click is
  // guaranteed to fire a fresh request — while the already-seeded channel axis
  // fires none.
  it("clicking a segment in one chart does not change another chart's list", async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('Nieuw')) // the status axis, non-default segment
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { status: 'new', period: 'month' } }))
    // No request was fired for the channel axis's ALREADY-seeded default (phone) —
    // it stayed exactly as mount left it.
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/outreach/drill'
      && (c[1] as { params: Record<string, unknown> }).params.channel === 'phone')).toBe(false)
  })

  // RAPPORT-COMPARE-2 (§4): the compare window lives in the right-hand filter
  // panel (ReportsPage) — the page itself renders NO inline compare control.
  it('renders no inline compare control (moved to the right filter panel)', () => {
    expect(screen.queryByText('Vergelijk met')).not.toBeInTheDocument()
  })

  // RAPPORT-GEZICHT-WAVE2 chart-type rule: campaign is a ranking axis → the
  // shared BarChartCard; its click still drills exactly like the old SegmentBars.
  it('renders the campaign axis as a bar chart whose click drills campaign=<uuid>', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Voorjaarsactie 2026').at(-1)!)
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { campaign: 'camp-archived-uuid', period: 'month' } }))
  })

  // Outcome is a few-value categorical axis → a donut; its click still drills
  // exactly like the old SegmentBars.
  it('renders the outcome axis as a donut whose click drills outcome=<value>', async () => {
    const user = userEvent.setup()
    mockUseOutreachReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Interested').at(-1)!)
    expect(getSpy).toHaveBeenCalledWith('/reports/outreach/drill',
      expect.objectContaining({ params: { outcome: 'interested', period: 'month' } }))
  })
})
