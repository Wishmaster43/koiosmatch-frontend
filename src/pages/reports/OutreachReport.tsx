/**
 * OutreachReport — call-list outreach report (GET /reports/outreach, REPORTS-2
 * fase 1, chart mix landed with RAPPORT-GEZICHT-WAVE2). Chart-type rule: ranking
 * axes (campaign, assignee) → bar charts; the few-value categorical axes
 * (channel, status, outcome — none carry a lookup colour, so donuts fall back to
 * the house series) → donuts; the window rendered prominently from the RESPONSE.
 * Drill XOR params follow the six-way outreach contract: campaign|assignee|
 * channel|status|outcome|date (+bucket=week next to a week bar's date). Every
 * axis sums to `total`; 'none'/'others' sentinels, "Onbekend"/"Geen uitkomst"
 * rows and orphan strings are normal, drillable entries — campaign accepts any
 * uuid (an archived campaign keeps its real name) and 'others' drills the exact
 * top-20 complement. KPI-OUTREACH-1 (CMBE K-191, commit 00e72f45): the strip is
 * now the server's own nine-card kpis[] suite, mirroring TasksReport's
 * KPI-TAKEN-1 idiom (kpiByServerKey Map, one predicate shared by value and
 * drill). Drill rows carry candidate names (outreach.view), so a 403 keeps the
 * calm degrade in the drawer. entityPage is deliberately NOT set on any drill
 * here: outreach drill rows are call-list targets, not a single unambiguous
 * entity record page.
 */
import { useState } from 'react'
import { BodyText } from '@/components/ui/typography'
import { formatPercent } from '@/lib/formatters'
import { useTranslation } from 'react-i18next'
import { buildReportQueryParams, EMPTY_REPORT_FILTERS } from './reportFilterParams'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import ReportGrid from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useOutreachReport } from './useOutreachReport'
import { gateDrillClick } from './reportDrillGate'
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { ChartDatum } from '@/components/charts/chartTypes'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'
import { getCompareSlug } from './reportCompareSupport'
import { useReportCompare } from './useReportCompare'
import ReportCompareMetric from './ReportCompareMetric'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'
import type { ReportFilterState } from './reportFilterParams'
import OutreachDepthSections from './depth/OutreachDepthSections'

// The plain single-value XOR axes; `assignee` has its own D2 shape below.
type Axis = 'campaign' | 'channel' | 'status' | 'outcome'

// Minimal surface the chart datum builders need — outreach axes carry no lookup
// colour, so donuts fall back to the house series.
type AxisSeg = { value: string; label: string; count: number }

export default function OutreachReport({ period, filters, compare = COMPARE_OFF }: { period: ReportPeriod; filters?: ReportFilterState; compare?: ReportCompareMode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useOutreachReport(period, filters)
  // RAPPORT-FILTERS-2: every drill/advice call carries the SAME panel filters the
  // envelope was drawn with (K-192: the advice routes validate them too) — bar,
  // card and drawer count one population.
  const baseParams = buildReportQueryParams(period, 'outreach', filters ?? EMPTY_REPORT_FILTERS)

  const total   = data?.total ?? data?.total_targets ?? 0
  const hasData = !loading && !error && total > 0

  // RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly.
  const compareSlug = getCompareSlug('outreach')
  const { data: compareData } = useReportCompare(compareSlug, data?.from, data?.to, compare, { period })
  const totalCompare = compare.kind !== 'off' ? (compareData?.total as { current: number; previous: number; delta: number; delta_pct: number | null } | undefined) : undefined

  // One shared drawer for the whole page — a KPI-card click and an axis/bucket
  // click both open the SAME drawer (replacing whatever was open before). Exactly
  // one XOR param per open drill.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrill({
      title: seg.label, value: seg.count, subtitle: windowSub(),
      rowsEndpoint: '/reports/outreach/drill', rowsParams: { ...baseParams, ...xorParam },
      adviceEndpoint: '/reports/outreach/advice', adviceParams: { ...baseParams, ...xorParam },
    })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/outreach/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/outreach/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  })

  // Chart datum builders (RAPPORT-GEZICHT-WAVE2 chart-type rule): 'none'/'others'
  // sentinels, "Onbekend"/"Geen uitkomst" rows and orphan strings are all normal
  // entries — each drills on its RAW value, exactly like any other segment. An
  // archived campaign keeps its name and drills on its uuid. Outreach axes carry
  // no lookup colour field, so donuts fall back to the house series.
  const donutData = (segs: AxisSeg[]): { data: ChartDatum[]; colors: string[] } => ({
    data: segs.map(s => ({ name: s.label, value: s.count, key: s.value })),
    colors: segs.map((_, i) => CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]),
  })
  const pickSegment = (axis: Axis, segs: AxisSeg[]) =>
    gateDrillClick('outreach', (d: unknown) => {
      const key = (d as { key?: string })?.key ?? (d as { payload?: { key?: string } })?.payload?.key
      const seg = segs.find(s => s.value === key)
      if (seg) openSegment(seg, { [axis]: seg.value })
    })
  const barData = (segs: AxisSeg[]): ChartDatum[] => segs.map(s => ({ name: s.label, value: s.count, key: s.value }))
  const pickBar = (axis: Axis, segs: AxisSeg[]) =>
    gateDrillClick('outreach', (d: ChartDatum) => {
      const seg = segs.find(s => s.value === d.key)
      if (seg) openSegment(seg, { [axis]: seg.value })
    })

  // Assignee axis (D2 shape: owner_id/name → the `assignee` param; a NULL
  // assignee arrives as the 'none' row, "Niet toegewezen") → ranking bar.
  const assigneeBarData = (segs: CandidateOwnerSegment[]): ChartDatum[] =>
    segs.map(s => ({ name: s.name, value: s.count, key: s.owner_id }))
  const pickAssigneeBar = (segs: CandidateOwnerSegment[]) =>
    gateDrillClick('outreach', (d: ChartDatum) => {
      const seg = segs.find(s => s.owner_id === d.key)
      if (seg) openSegment({ label: seg.name, count: seg.count }, { assignee: seg.owner_id })
    })

  const onSeriesPick = gateDrillClick('outreach', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // KPI-OUTREACH-1 (mirrors TasksReport's KPI-TAKEN-1): the nine-card strip
  // reads the server's own kpis[] suite verbatim — value and drawer share ONE
  // backend predicate per key, so a card's number and its drill rows can never
  // diverge. A key the server omitted (or a pre-suite cached envelope) renders
  // the house dash with no drill — never a value from another population.
  const kpiByServerKey = new Map((data?.kpis ?? []).map(k => [k.key, k.count]))
  const openKpiDrill = (kpi: string, label: string, value: string | number) =>
    gateDrillClick('outreach', () => setDrill({
      title: label, value, subtitle: windowSub(),
      rowsEndpoint: '/reports/outreach/kpis/drill', rowsParams: { ...baseParams, kpi },
    }))
  // Semantic colour only where the number is a SIGNAL and non-zero (§4: colour
  // carries meaning; a calm zero stays uncoloured).
  const KPI_COLOR: Partial<Record<string, string>> = {
    reached: 'var(--color-success)', not_reached: 'var(--color-danger)',
    open_todo: 'var(--color-warning)', due_today: 'var(--color-warning)',
  }
  const SUITE_LABEL_KEY: Record<string, string> = {
    total_targets: 'outreach.kpi.totalTargets', open_todo: 'outreach.kpi.openTodo',
    called_in_period: 'outreach.kpi.calledInPeriod', reached: 'outreach.kpi.reached',
    not_reached: 'outreach.kpi.notReached', conversion_pct: 'outreach.kpi.conversionPct',
    campaigns_active: 'outreach.kpi.campaignsActive', campaigns_done_in_period: 'outreach.kpi.campaignsDoneInPeriod',
    due_today: 'outreach.kpi.dueToday',
  }
  const openKpiParams = drill?.rowsParams as Record<string, unknown> | undefined
  const kpiByKey: Record<string, KpiSpec> = Object.fromEntries(
    Object.entries(SUITE_LABEL_KEY).map(([key, labelKey]) => {
      const label = t(labelKey)
      const raw = kpiByServerKey.get(key)
      const has = raw != null
      // conversion_pct is a float percentage, not a row count.
      const value = !has ? '—'
        : key === 'conversion_pct' ? formatPercent(raw as number)
        : raw
      return [key, {
        key, label, value,
        color: has && raw !== 0 ? KPI_COLOR[key] : undefined,
        active: openKpiParams?.kpi === key,
        sub: key === 'total_targets' && totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" /> : undefined,
        onClick: has ? openKpiDrill(key, label, value) : undefined,
      } satisfies KpiSpec]
    }))
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('outreach').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('outreach')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('outreach'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* KPI strip — above the tabs (candidate-page order: KPIs first) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('outreach.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). */}
      {!loading && !error && data && (
        <BodyText as="div" style={{ fontWeight: 500, marginBottom: 12 }}>
          {t('outreach.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </BodyText>
      )}

      {(!hasData || !data) && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <ReportStateBlock
            loading={loading} error={error} empty={!loading && !error && total === 0}
            loadingLabel={t('outreach.loading')} errorLabel={t('outreach.error')} emptyLabel={t('outreach.empty')}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {hasData && data && (
        <ReportGrid>
          {/* Targets over time — week/day timeseries, bucket set server-side. */}
          <ReportChartCard span={2} title={t('outreach.series')}
            chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />

          {/* Ranking axes → bar charts. Top-20 call lists + 'others' (the exact
              complement, a real drillable row); an archived campaign keeps its
              name and drills on its uuid. */}
          <ReportChartCard title={t('outreach.axes.campaign')} chart={
            <BarChartCard data={barData(data.by_campaign)} onBarClick={pickBar('campaign', data.by_campaign)} />} />
          <ReportChartCard title={t('tasks.axes.assignee')} chart={
            <BarChartCard data={assigneeBarData(data.by_assignee)} onBarClick={pickAssigneeBar(data.by_assignee)} />} />

          {/* Channel axis, zero-filled over the tenant channels + 'none' — few
              categorical values → donut. */}
          <ReportChartCard title={t('outreach.axes.channel')} chart={
            <PieChartCard {...donutData(data.by_channel)} onItemClick={pickSegment('channel', data.by_channel)} />} />

          {/* Status axis — the fase-1 breakdown, now summing to total with
              value/label pairs ("Onbekend" orphan bars included) → donut. */}
          <ReportChartCard title={t('customers.axes.status')} chart={
            <PieChartCard {...donutData(data.by_status)} onItemClick={pickSegment('status', data.by_status)} />} />

          {/* Outcome axis — incl. the "Geen uitkomst" sentinel so it sums to
              total → donut. Last odd card spans the full row (no grid hole). */}
          <ReportChartCard span={2} title={t('outreach.axes.outcome')} chart={
            <PieChartCard {...donutData(data.by_outcome)} onItemClick={pickSegment('outcome', data.by_outcome)} />} />

          {/* DASH-FEEDS-V3 depth: channel funnel + best-contact heatmap (halves,
              even parity) + the campaign timeseries last, span 2. */}
          <OutreachDepthSections data={data}
            onChannel={gateDrillClick('outreach', (channel: string, total: number) => openSegment({ label: t(`outreach.depth.channel.${channel}`, { defaultValue: channel }), count: total }, { channel }))} />
        </ReportGrid>
      )}

      {/* One shared drill drawer for the whole page. */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
