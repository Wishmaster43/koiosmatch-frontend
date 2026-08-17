/**
 * UsageOverviewReport — "Totaal": the first switch position of the Verbruik page,
 * where workflow-credits and AI-verbruik become ONE picture (GET /reports/usage).
 * A bureau gets one bill, so it needs one screen that explains the whole bill
 * rather than two that each explain half. AI and Workflows stay beside it as the
 * deep dives, unchanged.
 *
 * TWO THINGS THIS SCREEN SAYS OUT LOUD, because both are easy to misread:
 * (1) the module axis is WORKFLOW-ONLY by nature — AI usage carries no
 *     module_type, so there is nothing to bucket it into. A note under the chart
 *     says so; without it, a reader counts the module rows, compares them to the
 *     total and concludes rows went missing.
 * (2) the day bars are MERGED (workflow + AI), which is exactly why they may not
 *     be drilled through the workflows endpoint: that lade would structurally
 *     miss the AI half and disagree with the bar above it. The drill therefore
 *     waits for the report's own /reports/usage/drill pair and stays gated off
 *     until that is verified live (reportDrillGate) — no clickable surface with
 *     nowhere real to go.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { DrillSpec } from './ReportDrillDrawer'
import { useUsageOverviewReport } from './useUsageOverviewReport'
import { gateDrillClick, REPORT_DRILL_AVAILABLE } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportChartWithDrillList from './ReportChartWithDrillList'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import { formatRatio, formatNumber } from '@/lib/formatters'
import type { ReportPeriod, UsageOverviewDay } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

type DrillKey = 'module' | 'series'

// One day's merged consumption — the number the bar shows and the number the
// drill's meta.total must equal (backend contract).
const dayTotal = (d: UsageOverviewDay) => (d.workflow_credits ?? 0) + (d.ai_credits ?? 0)

export default function UsageOverviewReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { formatCurrency } = useNumberFormat()
  const { data, loading, error, refetch } = useUsageOverviewReport(period)

  const total = data?.totals.total ?? 0
  const hasData = !loading && !error && total > 0

  // Every section owns its own always-visible list, never one shared overlay —
  // clicking a module bar must not empty the day list beside the chart above it.
  const [drills, setDrills] = useState<Partial<Record<DrillKey, DrillSpec>>>({})
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openDrill = (key: DrillKey, title: string, value: number, xorParam: Record<string, unknown>) =>
    setDrills(d => ({ ...d, [key]: {
      title, value, subtitle: windowSub(),
      rowsEndpoint: '/reports/usage/drill', rowsParams: { ...xorParam, period },
      adviceEndpoint: '/reports/usage/advice', adviceParams: { ...xorParam, period },
    } }))

  const onModulePick = gateDrillClick('usage', (value: string) => {
    const seg = data?.by_module.find(s => s.value === value)
    if (seg) openDrill('module', seg.label, seg.count, { module: value })
  })
  const onSeriesPick = gateDrillClick('usage', (dateKey: string) => {
    const day = data?.timeseries.find(p => p.day === dateKey)
    if (day) openDrill('series', formatDate(day.day), dayTotal(day), { date: day.day })
  })

  // Seed each list with its own top segment so no panel is ever blank — but only
  // once the drill endpoint genuinely exists, or this would fire requests at a
  // route that isn't there and render a permanent error beside every chart.
  useEffect(() => {
    if (!data || !REPORT_DRILL_AVAILABLE.usage) return
    const topModule = data.by_module.reduce<typeof data.by_module[number] | null>(
      (best, x) => (!best || x.count > best.count ? x : best), null)
    if (topModule) openDrill('module', topModule.label, topModule.count, { module: topModule.value })
    const last = data.timeseries[data.timeseries.length - 1]
    if (last) openDrill('series', formatDate(last.day), dayTotal(last), { date: last.day })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.from, data?.to])

  // The nine cards, all read off (or honestly derived from) this one envelope —
  // no number here comes from anywhere the reader cannot reach on this page.
  const totals = data?.totals
  const days = data?.timeseries ?? []
  const activeDays = days.filter(d => dayTotal(d) > 0)
  const busiest = days.reduce<UsageOverviewDay | null>((best, d) => (!best || dayTotal(d) > dayTotal(best) ? d : best), null)
  const topModule = (data?.by_module ?? []).reduce<{ label: string; count: number } | null>(
    (best, x) => (!best || x.count > best.count ? x : best), null)
  const moduleCount = data?.by_module.length ?? 0

  const kpiByKey: Record<string, KpiSpec> = {
    total:           { key: 'total',           label: t('usage.summary.total'),           value: totals?.total ?? 0 },
    workflowCredits: { key: 'workflowCredits', label: t('usage.summary.workflowCredits'), value: totals?.workflow_credits ?? 0 },
    aiCredits:       { key: 'aiCredits',       label: t('usage.summary.aiCredits'),       value: totals?.ai_credits ?? 0 },
    aiAmount:        { key: 'aiAmount',        label: t('usage.summary.aiAmount'),
      value: totals?.ai_amount != null ? formatCurrency(totals.ai_amount) : '—' },
    modules:         { key: 'modules',         label: t('usage.summary.modules'),         value: moduleCount },
    topModule:       { key: 'topModule',       label: t('usage.summary.topModule'),
      value: topModule?.count ?? '—', sub: topModule?.label },
    busiestDay:      { key: 'busiestDay',      label: t('usage.summary.busiestDay'),
      value: busiest ? dayTotal(busiest) : '—', sub: busiest ? formatDate(busiest.day) : undefined },
    activeDays:      { key: 'activeDays',      label: t('usage.summary.activeDays'),      value: activeDays.length },
    avgPerDay:       { key: 'avgPerDay',       label: t('usage.summary.avgPerDay'),
      // Averaged over the days that actually consumed something: dividing by the
      // whole window would quietly report a lower rate for a bureau that simply
      // does not run at weekends.
      value: activeDays.length ? formatNumber(Math.round((totals?.total ?? 0) / activeDays.length)) : '—' },
    // Spares — three shares over numbers already on this page, plus the amount per
    // active day. Each is a ratio of two figures the reader can see and check.
    aiShare:         { key: 'aiShare',         label: t('usage.summary.aiShare'),
      value: totals && totals.total > 0 ? formatRatio(totals.ai_credits / totals.total) : '—' },
    workflowShare:   { key: 'workflowShare',   label: t('usage.summary.workflowShare'),
      value: totals && totals.total > 0 ? formatRatio(totals.workflow_credits / totals.total) : '—' },
    topModuleShare:  { key: 'topModuleShare',  label: t('usage.summary.topModuleShare'),
      value: topModule && totals && totals.workflow_credits > 0
        ? formatRatio(topModule.count / totals.workflow_credits) : '—' },
    amountPerDay:    { key: 'amountPerDay',    label: t('usage.summary.amountPerDay'),
      value: totals?.ai_amount != null && activeDays.length
        ? formatCurrency(totals.ai_amount / activeDays.length) : '—' },
  }

  // Which nine render, and in what order, is the tenant's Settings → Rapporten
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('usage').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('usage')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('usage'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  // The merged day series in the shared chart's own point shape.
  const series = days.map(d => ({ date: d.day, label: formatDate(d.day), value: dayTotal(d) }))
  const moduleMax = (data?.by_module ?? []).reduce((m, s) => Math.max(m, s.count), 0)

  return (
    <div>
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('usage.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, read off the RESPONSE — DD-MM-YYYY (DATUM-1). */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('usage.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && total === 0}
          loadingLabel={t('usage.loading')} errorLabel={t('usage.error')} emptyLabel={t('usage.empty')}
          onRetry={() => refetch()}
        />
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Consumption per day — both halves in one bar, so it foots to the totals above. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('usage.series')}</h3>
              <ReportChartWithDrillList drill={drills.series ?? null} placeholderLabel={t('usage.series')}
                chart={<ReportTimeseriesChart series={series} onPick={onSeriesPick} />} />
            </section>

            {/* Per module — workflow executions only; the note explains why, so the
                reader never has to guess whether AI rows are missing. */}
            <section>
              <h3 style={{ ...head, marginBottom: 4 }}>{t('usage.axes.module')}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>{t('usage.moduleNote')}</p>
              <ReportChartWithDrillList drill={drills.module ?? null} placeholderLabel={t('usage.axes.module')}
                chart={<SegmentBars max={moduleMax} onPick={onModulePick}
                  items={data.by_module.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))} />} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
