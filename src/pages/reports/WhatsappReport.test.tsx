/**
 * WhatsappReport — fixtures mirror the LIVE backend envelope (CMBE f7a2c6f8:
 * window nested under `meta`, top_conversations carrying candidate names, the
 * per-KPI drill on /reports/whatsapp/kpis/drill?kpi=<key> plus the axis/bucket
 * drill on /reports/whatsapp/axes/drill). The drill
 * tests assert the REQUEST (route + params), never only that a callback fired
 * (§13) — the previous round proved a green suite against an imagined contract
 * is worthless.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WhatsappReport from './WhatsappReport'
import type { WhatsappReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseWhatsappReport = vi.fn()
vi.mock('./useWhatsappReport', () => ({ useWhatsappReport: () => mockUseWhatsappReport() }))

// Spy on the underlying axios client so we can assert the exact request shape a
// KPI-card click sends. The drill rows fixture carries the SERVER-MASKED
// wa_number — exactly what the real ReportDrillController::whatsappKpi returns.
const MASKED_NUMBER = '06••••5678'
const FULL_NUMBER = '0612345678'
const getSpy = vi.fn().mockResolvedValue({ data: { data: [
  { name: 'Jan Jansen', wa_number: MASKED_NUMBER, status: 'open' },
], meta: { total: 1 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// Tenant KPI-order settings (RAPPORT-KPI-INSTELBAAR) — empty blob = today's
// default fixed order, unless a test overrides it.
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

const data: WhatsappReportData = {
  meta: { period: 'month', from: '2026-05-24', to: '2026-08-24', total: 40 },
  kpis: [
    { key: 'conversations_total', label: 'ignored', count: 40 },
    { key: 'active_7d', label: 'ignored', count: 18 },
    { key: 'new_in_period', label: 'ignored', count: 9 },
    { key: 'inbound_in_period', label: 'ignored', count: 25 },
    { key: 'outbound_in_period', label: 'ignored', count: 21 },
    { key: 'app_echoes_in_period', label: 'ignored', count: 5 },
    { key: 'escalations_open', label: 'ignored', count: 3 },
    { key: 'unanswered_over_window', label: 'ignored', count: 2 },
    { key: 'avg_first_response_minutes', label: 'ignored', count: 12 },
  ],
  timeseries: { bucket: 'week', series: [
    { date: '2026-05-24', inbound: 10, outbound: 8 },
    { date: '2026-08-20', inbound: 15, outbound: 13 },
  ] },
  by_direction: [
    { value: 'inbound', label: 'Inkomend', count: 25 },
    { value: 'outbound', label: 'Uitgaand', count: 15 },
  ],
  by_type: [
    { value: 'text', label: 'Tekst', count: 30 },
    { value: 'app_echo', label: 'Via app', count: 10 },
  ],
  // Real backend vocabulary: escalated/normal (not yes/no).
  by_escalated: [
    { value: 'escalated', label: 'Geëscaleerd', count: 3 },
    { value: 'normal', label: 'Niet geëscaleerd', count: 37 },
  ],
  // Real shape: candidate name + volume — no wa_number here (drill rows only).
  top_conversations: [
    { conversation_id: 'conv-1', candidate: 'Jan Jansen', message_count: 42, last_message_at: '2026-08-20' },
    { conversation_id: 'conv-2', candidate: null, message_count: 30, last_message_at: null },
  ],
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <WhatsappReport period="month" />
    </QueryClientProvider>,
  )
}

// The house LineChartCard needs real layout (jsdom has none) so the timeseries
// wrapper is mocked exactly like OutreachReport.test.tsx: one span per point.
vi.mock('./ReportTimeseriesChart', () => ({
  default: ({ series, onPick }: { series: { date: string; label: string; value: number }[]; onPick?: (dateKey: string) => void }) => (
    <>{series.map(p => (
      <span key={`${p.date}-${p.value}`} role={onPick ? 'button' : undefined}
        onClick={onPick ? () => onPick(p.date) : undefined}>{p.label}-{p.value}</span>
    ))}</>
  ),
}))

// RAPPORT-GEZICHT-WAVE2: the Recharts house donut needs real layout (jsdom has
// none) — the stub carries an explicit role="button" only when onItemClick is
// passed (mirrors the real component's clickable-vs-inert legend row), so
// tests locate the segment row via closest('[role="button"]') exactly as the
// old SegmentBars row did, and can assert a K-193 channel donut stays inert.
type StubDatum = { name: string; value: number; key?: string }
vi.mock('@/components/charts/PieChartCard', () => ({
  default: ({ data, onItemClick }: { data?: StubDatum[]; onItemClick?: (d: unknown) => void }) => (
    <>{(data ?? []).map(d => onItemClick
      ? <button key={d.key} role="button" onClick={() => onItemClick(d)}>{d.name}</button>
      : <span key={d.key}>{d.name}</span>)}</>
  ),
}))

describe('WhatsappReport (RAPPORTEN-WHATSAPP-FE-1)', () => {
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  it('shows the loading state', () => {
    mockUseWhatsappReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('WhatsApp laden…')).toBeInTheDocument()
  })

  it('shows the error state (calm degrade)', () => {
    mockUseWhatsappReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon WhatsApp niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no conversations', () => {
    mockUseWhatsappReport.mockReturnValue({
      data: { ...data, meta: { ...data.meta, total: 0 }, kpis: [], timeseries: { bucket: 'week', series: [] },
        by_direction: [], by_type: [], by_escalated: [], top_conversations: [] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen WhatsApp-gesprekken in deze periode')).toBeInTheDocument()
  })

  it('renders exactly nine KPI cards with real values from the fixture', () => {
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    const cardLabels = ['Totaal gesprekken', 'Actief (7 dagen)', 'Nieuw in periode', 'Inkomend in periode',
      'Uitgaand in periode', 'Via app in periode', 'Open escalaties', 'Onbeantwoord over drempel', 'Gem. eerste reactietijd']
    expect(cardLabels).toHaveLength(9)
    for (const label of cardLabels) expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    for (const count of [40, 18, 9, 25, 21, 5, 3, 2, 12]) expect(screen.getAllByText(String(count)).length).toBeGreaterThan(0)
  })

  it('renders every axis with every segment — nothing auto-drills on mount', () => {
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    for (const label of ['Inkomend', 'Uitgaand', 'Tekst', 'Via app', 'Geëscaleerd', 'Niet geëscaleerd']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    // No request fires on mount — rendering the segments never itself drills.
    expect(getSpy).not.toHaveBeenCalled()
  })

  // The axis drill (REPORTS-WHATSAPP-AXES-DRILL-1): a direction-segment click
  // hits GET /reports/whatsapp/axes/drill with axis + the segment's OWN raw value.
  // Timeseries bucket drill: value = the point's own count, the week bucket
  // rides along (a week bar's drawer must count the whole week), and the title
  // goes through the house date formatter — asserted on the REQUEST (§13).
  it('clicking a timeseries point drills with axis=timeseries + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    const firstDate = data.timeseries.series[0].date
    // The mock renders one clickable span per point (role=button) — two charts
    // (inbound + outbound) render the same dates; the first hit is inbound's.
    const point = screen.getAllByText(`${firstDate}-${data.timeseries.series[0].inbound}`, { exact: false })
      .map(el => el.closest('[role="button"]') ?? el).find(Boolean)
    await user.click(point!)
    expect(getSpy).toHaveBeenCalledWith('/reports/whatsapp/axes/drill',
      expect.objectContaining({ params: { axis: 'timeseries', value: firstDate, period: 'month', bucket: 'week' } }))
  })

  it('clicking a direction segment drills via /reports/whatsapp/axes/drill with axis=direction', async () => {
    const user = userEvent.setup()
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // The segment bar's own clickable row (role=button) — 'Inkomend' also labels
    // the KPI card and the timeseries caption, neither of which is a segment row.
    const segmentRow = screen.getAllByText('Inkomend').map(el => el.closest('[role="button"]')).find(Boolean)
    await user.click(segmentRow!)
    expect(getSpy).toHaveBeenCalledWith('/reports/whatsapp/axes/drill',
      expect.objectContaining({ params: { axis: 'direction', value: 'inbound', period: 'month' } }))
  })

  // Same drill, different axis: a top-conversation row drills on axis=conversation
  // with the raw conversation_id, never the rendered candidate name.
  it('clicking a top-conversation row drills via /reports/whatsapp/axes/drill with axis=conversation', async () => {
    const user = userEvent.setup()
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Jan Jansen'))
    expect(getSpy).toHaveBeenCalledWith('/reports/whatsapp/axes/drill',
      expect.objectContaining({ params: { axis: 'conversation', value: 'conv-1', period: 'month' } }))
  })

  it('renders top_conversations with candidate names and volumes — never a number, never message content', () => {
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    // A redacted candidate (null, no candidates.view) renders the house dash.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getAllByText('42').length).toBeGreaterThan(0)
    expect(screen.getByText('20-08-2026')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(FULL_NUMBER)
  })

  // The ONE whatsapp drill: per KPI card, kpi=<key> (§13: assert the request).
  it('clicking a KPI card drills via /reports/whatsapp/kpis/drill with kpi=<key>', async () => {
    const user = userEvent.setup()
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Totaal gesprekken'))
    expect(getSpy).toHaveBeenCalledWith('/reports/whatsapp/kpis/drill',
      expect.objectContaining({ params: { kpi: 'conversations_total', period: 'month' } }))
    // The drawer shows the drill rows — including the SERVER-masked wa_number,
    // rendered verbatim; the full number never appears anywhere.
    expect(await screen.findByText(MASKED_NUMBER, { exact: false })).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(FULL_NUMBER)
  })

  it('never calls an advice endpoint — whatsapp has none', async () => {
    const user = userEvent.setup()
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Open escalaties'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c => c[0] === '/reports/whatsapp/kpis/drill')).toBe(true)
  })

  // BELANGRIJK per contract: the window comes from the RESPONSE (meta) and must
  // render prominently as DD-MM-YYYY — never ISO (CLAUDE.md §3B DATUM-1).
  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('WhatsApp-gesprekken 24-05-2026 t/m 24-08-2026')).toBeInTheDocument()
    expect(screen.queryByText('2026-05-24')).not.toBeInTheDocument()
  })

  it('renders spare KPI cards with real values when picked in settings, strip stays nine', () => {
    mockSettings.mockReturnValue({
      report_kpis_whatsapp: [
        'active7d', 'newInPeriod', 'inboundInPeriod', 'outboundInPeriod', 'appEchoesInPeriod',
        'escalationsOpen', 'unansweredOverWindow', 'avgFirstResponseMinutes', 'conversationsTotal',
      ],
    })
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Actief (7 dagen)')).toBeInTheDocument()
    expect(screen.getByText('Totaal gesprekken')).toBeInTheDocument()
  })

  // REPORTGRID-1 item 4: whatsapp has NO backend compare slug
  // (reportCompareSupport.ts deliberately omits it), so the control never renders.
  it('never renders the ReportCompareControl (no backend compare support)', () => {
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.queryByText('Vergelijk met')).not.toBeInTheDocument()
  })

  // RAPPORT-GEZICHT-WAVE2: the type axis is now a donut too; its click still
  // drills exactly like the old SegmentBars did.
  it('renders the type axis as a donut whose click drills axis=type', async () => {
    const user = userEvent.setup()
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    const segmentRow = screen.getAllByText('Tekst').map(el => el.closest('[role="button"]')).find(Boolean)
    await user.click(segmentRow!)
    expect(getSpy).toHaveBeenCalledWith('/reports/whatsapp/axes/drill',
      expect.objectContaining({ params: { axis: 'type', value: 'text', period: 'month' } }))
  })

  // K-193 fase 0: with by_channel present, all four donuts render (the fixed
  // house KPI-order tests above already prove nothing else regressed), and the
  // escalated card no longer spans 2 (§ grid-parity: four halves, not 3+1).
  it('renders a fourth "channel" donut with per-value labels when by_channel is present', () => {
    mockUseWhatsappReport.mockReturnValue({
      data: { ...data, by_channel: [
        { value: 'waba', label: 'server label ignored', count: 20 },
        { value: 'waba_coex', label: 'server label ignored', count: 15 },
        { value: 'wa_web', label: 'server label ignored', count: 5 },
      ] },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Kanaal')).toBeInTheDocument()
    // The FE translates per enum value — the server's own label is ignored.
    expect(screen.getByText('WABA')).toBeInTheDocument()
    expect(screen.getByText('WABA · lokaal')).toBeInTheDocument()
    expect(screen.getByText('WA Web')).toBeInTheDocument()
    expect(screen.queryByText('server label ignored')).not.toBeInTheDocument()
    // The escalated card lost its span=2 — asserted via the grid item wrapper's
    // gridColumn style (ReportGridItem sets `1 / -1` only when span===2). The
    // title renders as an <h3>, so it never collides with the donut's own
    // 'Geëscaleerd' legend row.
    const escalatedTitle = screen.getByRole('heading', { name: 'Geëscaleerd' })
    const escalatedCard = escalatedTitle.closest('[style*="grid-column"]')
    expect(escalatedCard).toBeNull()
  })

  // Inert legend: the channel donut carries no onItemClick yet (drill axis
  // pending K-193 fase 1), so its rows render as plain text, not role=button.
  it('renders the channel donut as inert — no drill click, no request', async () => {
    const user = userEvent.setup()
    mockUseWhatsappReport.mockReturnValue({
      data: { ...data, by_channel: [{ value: 'waba', label: 'ignored', count: 40 }] },
      loading: false, error: false,
    })
    renderReport()
    const wabaLabel = screen.getByText('WABA')
    expect(wabaLabel.closest('[role="button"]')).toBeNull()
    getSpy.mockClear()
    await user.click(wabaLabel)
    expect(getSpy).not.toHaveBeenCalled()
  })

  // Fallback: an older envelope (no by_channel) renders exactly three donuts and
  // keeps the escalated card at full row span — no grid hole.
  it('renders no channel donut and keeps escalated spanning 2 when by_channel is absent', () => {
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.queryByText('Kanaal')).not.toBeInTheDocument()
    const escalatedTitle = screen.getByRole('heading', { name: 'Geëscaleerd' })
    const escalatedCard = escalatedTitle.closest('[style*="grid-column"]')
    expect(escalatedCard).not.toBeNull()
  })
})
