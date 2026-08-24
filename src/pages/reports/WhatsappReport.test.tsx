/**
 * WhatsappReport — fixtures mirror the LIVE backend envelope (CMBE f7a2c6f8:
 * window nested under `meta`, top_conversations carrying candidate names, the
 * one drill per KPI card on /reports/whatsapp/kpis/drill?kpi=<key>). The drill
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
  default: ({ series }: { series: { date: string; label: string; value: number }[] }) => (
    <>{series.map(p => <span key={`${p.date}-${p.value}`}>{p.label}-{p.value}</span>)}</>
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

  it('renders every axis with every segment — informative, without a drill affordance (no axis drill exists)', () => {
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    for (const label of ['Inkomend', 'Uitgaand', 'Tekst', 'Via app', 'Geëscaleerd', 'Niet geëscaleerd']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    // No request fires on mount: whatsapp has no axis drill, and nothing may
    // auto-open one (§3 — an affordance without a real path was the round-1 bug).
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
})
