/** WhatsappReport drills: the request each click sends (route + params) and the drawer it opens (split from WhatsappReport.test.tsx; fixtures in WhatsappReport.testKit.tsx). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import WhatsappReport from './WhatsappReport'
import { EMPTY_REPORT_FILTERS } from './reportFilterParams'
import { data, FULL_NUMBER, MASKED_NUMBER, renderReport } from './WhatsappReport.testKit'

const mockUseWhatsappReport = vi.fn()
vi.mock('./useWhatsappReport', () => ({ useWhatsappReport: () => mockUseWhatsappReport() }))

// The drill rows carry the SERVER-MASKED wa_number, as the real controller returns.
const getSpy = vi.fn().mockResolvedValue({ data: { data: [
  { name: 'Jan Jansen', wa_number: MASKED_NUMBER, status: 'open' },
], meta: { total: 1 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

vi.mock('./hooks/useReportKpiSelection', () => ({ useReportKpiSelection: () => ({ data: ['conversations_total', 'active_7d', 'new_in_period', 'inbound_in_period', 'outbound_in_period', 'app_echoes_in_period', 'escalations_open', 'unanswered_over_window', 'avg_first_response_minutes'] as string[], isLoading: false }) }))

vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => ({}) }
})

vi.mock('./ReportTimeseriesChart', () => ({
  default: ({ series, onPick }: { series: { date: string; label: string; value: number }[]; onPick?: (dateKey: string) => void }) => (
    <>{series.map(p => (
      <span key={`${p.date}-${p.value}`} role={onPick ? 'button' : undefined}
        onClick={onPick ? () => onPick(p.date) : undefined}>{p.label}-{p.value}</span>
    ))}</>
  ),
}))

type StubDatum = { name: string; value: number; key?: string }
vi.mock('@/components/charts/PieChartCard', () => ({
  default: ({ data, onItemClick }: { data?: StubDatum[]; onItemClick?: (d: unknown) => void }) => (
    <>{(data ?? []).map(d => onItemClick
      ? <button key={d.key} role="button" onClick={() => onItemClick(d)}>{d.name}</button>
      : <span key={d.key}>{d.name}</span>)}</>
  ),
}))

describe('WhatsappReport drills', () => {
  afterEach(() => { getSpy.mockClear() })

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
    // 'Inkomend' is the fixture's own server label (axis data, not FE copy). The segment bar's clickable row (role=button) also carries it
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

  // REPORT-WA-DRILL-FILTERS-1: every drill carries the panel filters, so a drill whose axis
  // OPPOSES the panel (axis=escalated value=normal under escalated=1) sends both and the
  // drawer shows the empty state the backend's intersection returns.
  it('a drill sends the panel filters beside its axis and renders the empty state for an opposing panel value', async () => {
    const user = userEvent.setup()
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    getSpy.mockResolvedValueOnce({ data: { data: [], meta: { total: 0 } } })
    const qc = new QueryClient()
    render(
      <QueryClientProvider client={qc}>
        <WhatsappReport period="month" filters={{ ...EMPTY_REPORT_FILTERS, escalated: true }} />
      </QueryClientProvider>,
    )
    const row = screen.getAllByText(i18n.t('whatsapp.axes.escalatedValues.normal', { ns: 'analytics' })).map(el => el.closest('[role="button"]')).find(Boolean)
    await user.click(row!)
    expect(getSpy).toHaveBeenCalledWith('/reports/whatsapp/axes/drill',
      expect.objectContaining({ params: { period: 'month', escalated: 1, axis: 'escalated', value: 'normal' } }))
    expect(await screen.findByText(i18n.t('drill.noRecords', { ns: 'analytics' }))).toBeInTheDocument()
  })

  // The ONE whatsapp drill: per KPI card, kpi=<key> (§13: assert the request).
  it('clicking a KPI card drills via /reports/whatsapp/kpis/drill with kpi=<key>', async () => {
    const user = userEvent.setup()
    mockUseWhatsappReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText(i18n.t('whatsapp.kpi.conversationsTotal', { ns: 'analytics' })))
    expect(getSpy).toHaveBeenCalledWith('/reports/whatsapp/kpis/drill',
      expect.objectContaining({ params: { kpi: 'conversations_total', period: 'month' } }))
    // The drawer shows the drill rows — including the SERVER-masked wa_number,
    // rendered verbatim; the full number never appears anywhere.
    expect(await screen.findByText(MASKED_NUMBER, { exact: false })).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(FULL_NUMBER)
  })
})
