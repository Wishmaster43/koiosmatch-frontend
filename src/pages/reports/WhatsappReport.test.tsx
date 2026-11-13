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
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { data, FULL_NUMBER, MASKED_NUMBER, renderReport } from './WhatsappReport.testKit'
import type { WhatsappReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseWhatsappReport = vi.fn()
vi.mock('./useWhatsappReport', () => ({ useWhatsappReport: () => mockUseWhatsappReport() }))

// Spy on the underlying axios client so we can assert the exact request shape a
// KPI-card click sends. The drill rows fixture carries the SERVER-MASKED
// wa_number — exactly what the real ReportDrillController::whatsappKpi returns.
const getSpy = vi.fn().mockResolvedValue({ data: { data: [
  { name: 'Jan Jansen', wa_number: MASKED_NUMBER, status: 'open' },
], meta: { total: 1 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// The stored selection mock carries the BE snake_case default (config/report_kpis.php whatsapp), so no fallback banner renders.
const mockUseReportKpiSelection = vi.fn(() => ({ data: ['conversations_total', 'active_7d', 'new_in_period', 'inbound_in_period', 'outbound_in_period', 'app_echoes_in_period', 'escalations_open', 'unanswered_over_window', 'avg_first_response_minutes'] as string[], isLoading: false }))
vi.mock('./hooks/useReportKpiSelection', () => ({ useReportKpiSelection: () => mockUseReportKpiSelection() }))

// Tenant KPI-order settings (RAPPORT-KPI-INSTELBAAR) — empty blob = today's
// default fixed order, unless a test overrides it.
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

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

  // WA-REPORT-TOLERANT-1: the demo envelope carried no by_type (10-09 sweep) and the
  // page hit the error boundary; a missing axis is an empty donut, never a crash.
  it('renders the measured demo shape (a flat timeseries array, no top list) without crashing', () => {
    const { top_conversations: _omittedTop, ...partial } = data
    void _omittedTop
    const flat = { ...partial, timeseries: data.timeseries.series }
    mockUseWhatsappReport.mockReturnValue({ data: flat as unknown as WhatsappReportData, loading: false, error: false })
    expect(() => renderReport()).not.toThrow()
    expect(screen.queryByText(/Er ging iets mis/)).toBeNull()
  })

  it('renders without crashing when the envelope leaves out an axis', () => {
    const { by_type: _omitted, ...partial } = data
    void _omitted
    mockUseWhatsappReport.mockReturnValue({ data: partial as unknown as WhatsappReportData, loading: false, error: false })
    expect(() => renderReport()).not.toThrow()
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
    for (const label of ['Inkomend', 'Uitgaand', 'Tekst', 'Via app', 'Open escalatie', 'Normaal']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    // No request fires on mount — rendering the segments never itself drills.
    expect(getSpy).not.toHaveBeenCalled()
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
        'active_7d', 'new_in_period', 'inbound_in_period', 'outbound_in_period', 'app_echoes_in_period',
        'escalations_open', 'unanswered_over_window', 'avg_first_response_minutes', 'conversations_total',
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

  // CMBE 4878fb76: the channel donut drills through axis='channel', same as
  // every other axis on this report — the RAW server value travels, not the
  // translated label.
  it('drills the channel donut on axis=channel with the raw server value', async () => {
    const user = userEvent.setup()
    mockUseWhatsappReport.mockReturnValue({
      data: { ...data, by_channel: [{ value: 'waba_coex', label: 'ignored', count: 40 }] },
      loading: false, error: false,
    })
    renderReport()
    const wabaLabel = screen.getByText('WABA · lokaal')
    await user.click(wabaLabel.closest('[role="button"]')!)
    expect(getSpy).toHaveBeenCalledWith('/reports/whatsapp/axes/drill',
      expect.objectContaining({ params: { axis: 'channel', value: 'waba_coex', period: 'month' } }))
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

// KPI-BUILDER-FE-1 slice 3: tenant-defined KPI cards ride a second band row,
// sharing the report's one drawer state. No entityPage: rows carry masked
// numbers, no single record page (§8).
describe('WhatsappReport · tenant custom KPI cards (KPI-BUILDER-FE-1)', () => {
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  const customKpi = {
    id: 'kd-4', entity: 'whatsapp' as const, metric_key: 'inbound_in_period', label: 'Eigen inkomend',
    dimension: 'all', dimension_value: null, dimension_label: null, value: 19, unit: 'count' as const,
    target: 20, warn: null, comparison: 'gte' as const, status: 'warn' as const,
  }

  it('renders the tenant card with its label/value/target caption and the band title', () => {
    mockUseWhatsappReport.mockReturnValue({ data: { ...data, custom_kpis: [customKpi] }, loading: false, error: false })
    renderReport()
    expect(screen.getByText("Eigen KPI's")).toBeInTheDocument()
    expect(screen.getByText('Eigen inkomend')).toBeInTheDocument()
    expect(screen.getByText(/doel 20/)).toBeInTheDocument()
  })

  it('clicking the tenant card opens the definition drill with only the accepted params', async () => {
    const user = userEvent.setup()
    mockUseWhatsappReport.mockReturnValue({ data: { ...data, custom_kpis: [customKpi] }, loading: false, error: false })
    renderReport()
    await user.click(screen.getByTitle('Eigen inkomend'))
    expect(getSpy).toHaveBeenCalledWith('/reports/kpi-definitions/kd-4/drill', expect.objectContaining({ params: expect.objectContaining({ period: 'month' }) }))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/kpi-definitions/kd-4/drill')
    expect(call?.[1].params).not.toHaveProperty('kpi')
    expect(call?.[1].params).not.toHaveProperty('date')
  })

  it('renders a dash with no click for a null-value tenant card', async () => {
    const user = userEvent.setup()
    mockUseWhatsappReport.mockReturnValue({ data: { ...data, custom_kpis: [{ ...customKpi, value: null }] }, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Eigen inkomend')).toBeInTheDocument()
    await user.click(screen.getByTitle('Eigen inkomend'))
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/kpi-definitions/kd-4/drill')).toBe(false)
  })
})
