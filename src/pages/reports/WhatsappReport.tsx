/**
 * WhatsappReport — WhatsApp conversations report (GET /reports/whatsapp, LIVE —
 * CMBE f7a2c6f8; RAPPORTEN-WHATSAPP-FE-1). Nine KPI cards through ReportKpiBand +
 * kpiCatalog ('whatsapp' fixed family), dashboard-style chart blocks (inbound/
 * outbound over time, direction/type/escalated breakdowns, a top-conversations
 * list). Two drills exist: per KPI card (GET /reports/whatsapp/kpis/drill?kpi=<key>,
 * ReportDrillController::whatsappKpi) and a per-axis drill (GET
 * /reports/whatsapp/axes/drill, operation getReportsWhatsappAxesDrill in
 * api-generated.ts) covering direction/type/escalated/conversation/timeseries.
 * There is still NO advice route for this report.
 *
 * PRIVACY (§8/§9): the DRILL rows carry a wa_number the SERVER already masked —
 * rendered verbatim through the shared drill drawer, never un-masked or
 * reformatted. `top_conversations` carries the candidate name (server-gated),
 * never a number and never message content.
 *
 * Chart mix (RAPPORT-GEZICHT-WAVE2): direction/type/escalated/channel are all
 * few-value categorical axes with no lookup colour field → donuts on the house
 * series. Escalated spans the full row only when the channel donut (K-193
 * fase 0, optional `by_channel`) is absent — with it present the grid holds
 * four half-width donuts (even parity); without it three halves would leave a
 * grid hole. top_conversations stays a table (its own special face, per the brief).
 * entityPage is deliberately NOT set on any drill here: conversation rows carry
 * masked numbers, no unambiguous single record page to deep-link into.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import ReportGrid from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useWhatsappReport } from './useWhatsappReport'
import { gateDrillClick } from './reportDrillGate'
import PieChartCard from '@/components/charts/PieChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { ChartDatum } from '@/components/charts/chartTypes'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { BodyText, Caption, Mono } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import type { ReportPeriod, WhatsappSegment } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'
import type { ReportFilterState } from './reportFilterParams'

// Semantic colour per server key, applied only when the count is non-zero (§4:
// colour carries meaning — a calm zero stays uncoloured). avg_first_response_
// minutes carries no unambiguous signal direction, so it stays uncoloured.
const KPI_COLOR: Partial<Record<string, string>> = {
  escalations_open: 'var(--color-danger)',
  unanswered_over_window: 'var(--color-warning)',
}
// The nine fixed KPI keys the live backend returns (WhatsappReport::CARDS), in
// camelCase label form (whatsapp.kpi.*) — the server's own `label` is
// intentionally ignored (§5: every user-facing string goes through i18n).
const KPI_LABEL_KEYS: Record<string, string> = {
  conversations_total: 'whatsapp.kpi.conversationsTotal',
  active_7d: 'whatsapp.kpi.active7d',
  new_in_period: 'whatsapp.kpi.newInPeriod',
  inbound_in_period: 'whatsapp.kpi.inboundInPeriod',
  outbound_in_period: 'whatsapp.kpi.outboundInPeriod',
  app_echoes_in_period: 'whatsapp.kpi.appEchoesInPeriod',
  escalations_open: 'whatsapp.kpi.escalationsOpen',
  unanswered_over_window: 'whatsapp.kpi.unansweredOverWindow',
  avg_first_response_minutes: 'whatsapp.kpi.avgFirstResponseMinutes',
}

export default function WhatsappReport({ period, filters }: { period: ReportPeriod; filters?: ReportFilterState }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { formatNumber } = useNumberFormat()
  const { data, loading, error, refetch } = useWhatsappReport(period, true, filters)

  const total = data?.meta.total ?? 0
  const hasData = !loading && !error && total > 0

  // Per-KPI drill (the one drill the backend offers): clicking a card opens the
  // shared drawer on GET /reports/whatsapp/kpis/drill?kpi=<key> — rows carry the
  // server-masked wa_number, rendered verbatim by the drawer.
  const [kpiDrill, setKpiDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.meta.from)} – ${formatDate(data?.meta.to)}`
  const openKpiDrill = (serverKey: string, label: string, value: string | number) =>
    gateDrillClick('whatsapp', () => setKpiDrill({
      title: label, value, subtitle: windowSub(),
      rowsEndpoint: '/reports/whatsapp/kpis/drill', rowsParams: { kpi: serverKey, period },
    }))

  // The one axis drill (GET /reports/whatsapp/axes/drill) reuses the same drawer
  // state as the KPI drill — a segment/row click replaces whatever was open.
  // Gating happens at the CALL SITE (mirrors bars()/openSegment split elsewhere),
  // so this itself always performs the update once invoked.
  const openAxisDrill = (axis: 'direction' | 'type' | 'escalated' | 'conversation' | 'channel', label: string, value: string | number, rawValue: string) =>
    setKpiDrill({
      title: label, value, subtitle: windowSub(),
      rowsEndpoint: '/reports/whatsapp/axes/drill', rowsParams: { axis, value: rawValue, period },
    })
  // Timeseries bucket drill — value = the clicked point's own count, title =
  // chart label + DD-MM-YYYY date (DATUM-1), and the server bucket granularity
  // forwarded so a week bar's drawer counts the whole week.
  const openBucketDrill = (chartLabel: string, count: number, dateKey: string) =>
    setKpiDrill({
      title: `${chartLabel} · ${formatDate(dateKey)}`, value: count, subtitle: windowSub(),
      rowsEndpoint: '/reports/whatsapp/axes/drill',
      rowsParams: { axis: 'timeseries', value: dateKey, period,
        ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    })

  // RAPPORT-GEZICHT-WAVE2 chart-type rule: all three axes are few-value
  // categorical breakdowns (2-4 values, no lookup colour field) → donuts falling
  // back to the house series. Each slice still drills on its own RAW server
  // `value`, never the translated label (§ contract discipline).
  const donutData = (segs: WhatsappSegment[]): { data: ChartDatum[]; colors: string[] } => ({
    data: segs.map(s => ({ name: s.label, value: s.count, key: s.value })),
    colors: segs.map((_, i) => CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]),
  })
  const pickSegment = (axis: 'direction' | 'type' | 'escalated' | 'channel', segs: WhatsappSegment[]) =>
    gateDrillClick('whatsapp', (d: unknown) => {
      const key = (d as { key?: string })?.key ?? (d as { payload?: { key?: string } })?.payload?.key
      const seg = segs.find(s => s.value === key)
      // The channel axis titles its drawer with the same translated label the donut shows.
      if (seg) openAxisDrill(axis, axis === 'channel' ? t(`whatsapp.channel.${seg.value}`, { defaultValue: seg.label }) : seg.label, seg.count, seg.value)
    })
  // Channel donut labels: per-enum-value translation (nl "WABA" / "WABA · lokaal"
  // / "WA Web"), falling back to the server's own label only when a locale key
  // is missing — never the raw server value verbatim (§ contract discipline).
  const channelDonutData = (segs: WhatsappSegment[]): { data: ChartDatum[]; colors: string[] } => ({
    data: segs.map(s => ({ name: t(`whatsapp.channel.${s.value}`, { defaultValue: s.label }), value: s.count, key: s.value })),
    colors: segs.map((_, i) => CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]),
  })
  // K-193: the channel card exists only when the envelope carries a NON-EMPTY
  // by_channel (an empty array must not shrink the escalated card or draw an empty donut).
  const hasChannel = (data?.by_channel?.length ?? 0) > 0

  // The nine fixed cards straight off the server's kpis[] array — each label from
  // the local i18n catalogue, each card clickable into its own drill.
  const kpiByServerKey = new Map((data?.kpis ?? []).map(k => [k.key, k.count]))
  const kpiByKey: Record<string, KpiSpec> = Object.fromEntries(
    Object.entries(KPI_LABEL_KEYS).map(([serverKey, labelKey]) => {
      const camelKey = labelKey.split('.').pop()!
      const raw = kpiByServerKey.get(serverKey)
      // The avg-response-time card carries a minutes unit; every other card is a
      // plain count. Both render the house dash when the field is genuinely absent.
      const value = raw == null ? '—' : serverKey === 'avg_first_response_minutes' ? formatNumber(raw) : raw
      const sub = raw != null && serverKey === 'avg_first_response_minutes' ? t('whatsapp.kpi.minutesUnit') : undefined
      const onClick = openKpiDrill(serverKey, t(labelKey), value)
      const color = raw != null && raw !== 0 ? KPI_COLOR[serverKey] : undefined
      return [camelKey, { key: camelKey, label: t(labelKey), value, sub, color, ...(onClick ? { onClick } : {}) }]
    }),
  )

  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('whatsapp').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('whatsapp')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('whatsapp'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* KPI strip — above the charts (candidate-page order: KPIs first) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('whatsapp.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). */}
      {!loading && !error && data && (
        <BodyText style={{ fontWeight: 500, marginBottom: 12 }}>
          {t('whatsapp.window', { from: formatDate(data.meta.from), to: formatDate(data.meta.to) })}
        </BodyText>
      )}

      {(!hasData || !data) && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <ReportStateBlock
            loading={loading} error={error} empty={!loading && !error && total === 0}
            loadingLabel={t('whatsapp.loading')} errorLabel={t('whatsapp.error')} emptyLabel={t('whatsapp.empty')}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {hasData && data && (
        <ReportGrid>
          {/* Inbound/outbound over time — two lines through the same shared
              timeseries chart OutreachReport uses. */}
          <ReportChartCard span={2} title={t('whatsapp.series')} chart={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* A point drill explains that BUCKET: the drawer value is the point's
                  own count, the title carries the chart + house-formatted date, and
                  the week granularity rides along (mirrors ApplicationsReport's
                  openBucket) — the contract has no direction+date pair, so the
                  drawer's rows span BOTH directions of the bucket; each chart's
                  title says which number the user clicked. */}
              <div>
                <Caption style={{ fontWeight: 600, marginBottom: 4, display: 'block' }}>{t('whatsapp.inbound')}</Caption>
                <ReportTimeseriesChart series={data.timeseries.series.map(p => ({ date: p.date, label: p.date, value: p.inbound }))}
                  onPick={gateDrillClick('whatsapp', (dateKey: string) => {
                    const pt = data.timeseries.series.find(p => p.date === dateKey)
                    if (pt) openBucketDrill(t('whatsapp.inbound'), pt.inbound, dateKey)
                  })} />
              </div>
              <div>
                <Caption style={{ fontWeight: 600, marginBottom: 4, display: 'block' }}>{t('whatsapp.outbound')}</Caption>
                <ReportTimeseriesChart series={data.timeseries.series.map(p => ({ date: p.date, label: p.date, value: p.outbound }))}
                  onPick={gateDrillClick('whatsapp', (dateKey: string) => {
                    const pt = data.timeseries.series.find(p => p.date === dateKey)
                    if (pt) openBucketDrill(t('whatsapp.outbound'), pt.outbound, dateKey)
                  })} />
              </div>
            </div>
          } />

          {/* Few-value categorical axes → donuts. Escalated spans the full row
              only when the channel donut is absent (older envelope): with the
              channel card present the grid holds four halves (even parity), so
              escalated shrinks back to a half card. */}
          <ReportChartCard title={t('whatsapp.axes.direction')} chart={
            <PieChartCard {...donutData(data.by_direction)} onItemClick={pickSegment('direction', data.by_direction)} />} />
          <ReportChartCard title={t('whatsapp.axes.type')} chart={
            <PieChartCard {...donutData(data.by_type)} onItemClick={pickSegment('type', data.by_type)} />} />
          <ReportChartCard span={hasChannel ? undefined : 2} title={t('whatsapp.axes.escalated')} chart={
            <PieChartCard {...donutData(data.by_escalated)} onItemClick={pickSegment('escalated', data.by_escalated)} />} />
          {/* Channel donut (K-193 fase 0) — rendered only when the envelope
              carries it. Drills through axis='channel' (CMBE 4878fb76), same
              window/panel filters as every other axis on this report. */}
          {hasChannel && (
            <ReportChartCard title={t('whatsapp.axes.channel')} chart={
              <PieChartCard {...channelDonutData(data.by_channel ?? [])} onItemClick={pickSegment('channel', data.by_channel ?? [])} />} />
          )}

          {/* Top-10 busiest threads — candidate name (server-gated) + volume;
              no numbers, no message content here (§8/§9). */}
          <ReportChartCard span={2} title={t('whatsapp.topConversations')} chart={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.top_conversations.map(c => {
                const onPick = gateDrillClick('whatsapp', () =>
                  openAxisDrill('conversation', c.candidate || '—', c.message_count, String(c.conversation_id)))
                return (
                  <div key={String(c.conversation_id)} onClick={onPick} role={onPick ? 'button' : undefined}
                    tabIndex={onPick ? 0 : undefined}
                    onKeyDown={onPick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick() } } : undefined}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 10, padding: '6px 10px', borderRadius: 8, background: 'var(--hover-bg)', cursor: onPick ? 'pointer' : 'default' }}>
                    <BodyText style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.candidate || '—'}
                    </BodyText>
                    {c.last_message_at && <Caption style={{ whiteSpace: 'nowrap' }}>{formatDate(c.last_message_at)}</Caption>}
                    <Mono style={{ fontWeight: 600 }}>{c.message_count}</Mono>
                  </div>
                )
              })}
            </div>
          } />
        </ReportGrid>
      )}

      {/* The per-KPI drill drawer — same shared drawer every report uses. */}
      <ReportDrillDrawer drill={kpiDrill} onClose={() => setKpiDrill(null)} />
    </div>
  )
}
