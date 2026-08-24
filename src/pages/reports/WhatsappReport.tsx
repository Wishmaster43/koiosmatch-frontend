/**
 * WhatsappReport — WhatsApp conversations report (GET /reports/whatsapp, LIVE —
 * CMBE f7a2c6f8; RAPPORTEN-WHATSAPP-FE-1). Nine KPI cards through ReportKpiBand +
 * kpiCatalog ('whatsapp' fixed family), dashboard-style chart blocks (inbound/
 * outbound over time, direction/type/escalated breakdowns, a top-conversations
 * list) and a drill-down PER KPI CARD — the backend's one whatsapp drill is
 * GET /reports/whatsapp/kpis/drill?kpi=<key> (ReportDrillController::whatsappKpi);
 * there is NO axis/bucket drill and NO advice route for this report, so the axis
 * bars deliberately carry no click (§3: no affordance without a real path).
 *
 * PRIVACY (§8/§9): the DRILL rows carry a wa_number the SERVER already masked —
 * rendered verbatim through the shared drill drawer, never un-masked or
 * reformatted. `top_conversations` carries the candidate name (server-gated),
 * never a number and never message content.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useWhatsappReport } from './useWhatsappReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { BodyText, Caption, Mono } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import type { ReportPeriod, WhatsappSegment } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

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

export default function WhatsappReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { formatNumber } = useNumberFormat()
  const { data, loading, error, refetch } = useWhatsappReport(period)

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

  // Plain axis bars — informative, not clickable (no axis drill exists, §3).
  const bars = (segs: WhatsappSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    return <SegmentBars max={max} items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))} />
  }

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
      return [camelKey, { key: camelKey, label: t(labelKey), value, sub, ...(onClick ? { onClick } : {}) }]
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

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && total === 0}
          loadingLabel={t('whatsapp.loading')} errorLabel={t('whatsapp.error')} emptyLabel={t('whatsapp.empty')}
          onRetry={() => refetch()}
        />
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Inbound/outbound over time — two lines through the same shared
                timeseries chart OutreachReport uses. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('whatsapp.series')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <Caption style={{ fontWeight: 600, marginBottom: 4, display: 'block' }}>{t('whatsapp.inbound')}</Caption>
                  <ReportTimeseriesChart series={data.timeseries.series.map(p => ({ date: p.date, label: p.date, value: p.inbound }))} />
                </div>
                <div>
                  <Caption style={{ fontWeight: 600, marginBottom: 4, display: 'block' }}>{t('whatsapp.outbound')}</Caption>
                  <ReportTimeseriesChart series={data.timeseries.series.map(p => ({ date: p.date, label: p.date, value: p.outbound }))} />
                </div>
              </div>
            </section>

            {/* Direction axis. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('whatsapp.axes.direction')}</h3>
              {bars(data.by_direction)}
            </section>

            {/* Message type axis. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('whatsapp.axes.type')}</h3>
              {bars(data.by_type)}
            </section>

            {/* Escalated axis. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('whatsapp.axes.escalated')}</h3>
              {bars(data.by_escalated)}
            </section>

            {/* Top-10 busiest threads — candidate name (server-gated) + volume;
                no numbers, no message content here (§8/§9). */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('whatsapp.topConversations')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.top_conversations.map(c => (
                  <div key={String(c.conversation_id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 10, padding: '6px 10px', borderRadius: 8, background: 'var(--hover-bg)' }}>
                    <BodyText style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.candidate || '—'}
                    </BodyText>
                    {c.last_message_at && <Caption style={{ whiteSpace: 'nowrap' }}>{formatDate(c.last_message_at)}</Caption>}
                    <Mono style={{ fontWeight: 600 }}>{c.message_count}</Mono>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* The per-KPI drill drawer — same shared drawer every report uses. */}
      <ReportDrillDrawer drill={kpiDrill} onClose={() => setKpiDrill(null)} />
    </div>
  )
}
