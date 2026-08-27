/**
 * OpportunitiesReport — opportunities (kansen) pipeline report (GET
 * /reports/opportunities, RAPPORTEN-SUITE-1 "portie 5"). KPI-OPP-1 (CMBE 27-08,
 * commit eb3af985): the strip now reads the server's own nine-card kpis[] suite
 * verbatim (total/open/won/lost/win_rate/open_value/stale/closing_soon/overdue),
 * mirroring KPI-MATCHES-1/KPI-TAKEN-1. Below the strip: the shared timeseries,
 * the stage/customer/owner/branch axes — untouched by the strip migration. Their
 * own drill/advice XOR params still follow the five-way opportunities contract:
 * stage|customer|owner|branch|date (+bucket=week next to a week bar's date).
 * forecast_count/forecast_value lose their strip surface with this migration —
 * the spec ordered the spares removed and neither has a chart surface below
 * (Danny screen note, see openQuestions in the delivery).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import ReportGrid from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import ReportDrillDrawer from './ReportDrillDrawer'
import { BodyText } from '@/components/ui/typography'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { DrillSpec } from './ReportDrillDrawer'
import { useOpportunitiesReport } from './useOpportunitiesReport'
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
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import { formatKpiUnitValue } from './kpiUnitFormat'
import type { KpiUnit } from './kpiUnitFormat'

// The three plain single-value XOR axes; `owner` has its own D2 shape below.
type Axis = 'stage' | 'customer' | 'branch'

// Minimal surface the generic bar renderer needs — stage rows carry a lookup
// colour, customer/branch rows do not (SegmentBars falls back to the primary tint).
type AxisSeg = { value: string; label: string; count: number; color?: string | null }

// Opportunities pipeline report (see file docblock above): KPI band, chart grid
// and drill drawer, mirroring the customers/vacancies reports' shared envelope.
export default function OpportunitiesReport({ period, filters = EMPTY_REPORT_FILTERS, compare = COMPARE_OFF }: { period: ReportPeriod; filters?: ReportFilterState; compare?: ReportCompareMode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useOpportunitiesReport(period, filters)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly.
  const compareSlug = getCompareSlug('opportunities')
  const { data: compareData } = useReportCompare(compareSlug, data?.period.from, data?.period.to, compare, { period })
  const totalCompare = compare.kind !== 'off' ? (compareData?.total as { current: number; previous: number; delta: number; delta_pct: number | null } | undefined) : undefined

  // Drill-down: one shared drawer for the whole page — a segment/bucket click
  // opens it fresh, replacing whatever was open before. Exactly one XOR param
  // per open drill.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.period.from)} – ${formatDate(data?.period.to)}`
  // Every drill (axis segment, bucket, KPI card) layers on top of the report's own
  // active panel filters (status/owner/branch/customer + value_min/value_max),
  // never just `period` — mirrors VacanciesReport's baseParams so bar and drawer
  // total always agree on the same underlying set. buildReportQueryParams already
  // attaches value_min/value_max for 'opportunities' (reportFilterParams.ts).
  const baseParams = buildReportQueryParams(period, 'opportunities', filters)
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrill({
      title: seg.label, value: seg.count, subtitle: windowSub(),
      entityPage: 'opportunities',
      rowsEndpoint: '/reports/opportunities/drill', rowsParams: { ...baseParams, ...xorParam },
      // K-192: advice now validates the panel filters exactly like the drill (see
      // getReportsOpportunitiesAdvice, api-generated.ts:46593 — owner_id/location_id/
      // status/customer_id/value_min/value_max all listed) — so advice and drawer
      // rows share one population. baseParams already carries period.
      adviceEndpoint: '/reports/opportunities/advice', adviceParams: { ...baseParams, ...xorParam },
    })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/opportunities/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/opportunities/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  })

  // Stage axis: a lookup axis with its own colour per value (CHART-TYPE RULE) →
  // donut. 'none'/'others' sentinels and orphaned (deleted-lookup) values are
  // all normal array entries — each slice drills on its RAW value.
  const stageDonut = (segs: AxisSeg[]) => {
    const donutData = {
      data: segs.map(s => ({ name: s.label, value: s.count, key: s.value })),
      colors: segs.map((s, i) => s.color ?? CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]),
    }
    const onPick = gateDrillClick('opportunities', (d: unknown) => {
      const key = (d as { key?: string })?.key ?? (d as { payload?: { key?: string } })?.payload?.key
      const seg = segs.find(s => s.value === key)
      if (seg) openSegment(seg, { stage: key })
    })
    return <PieChartCard {...donutData} onItemClick={onPick} />
  }

  // Ranking axes (customer/branch: people/orgs, no lookup colour) → bar chart.
  const bars = (axis: Exclude<Axis, 'stage'>, segs: AxisSeg[]) => {
    const data: ChartDatum[] = segs.map(s => ({ name: s.label, value: s.count, key: s.value }))
    const onPick = gateDrillClick('opportunities', (d: ChartDatum) => {
      const seg = segs.find(s => s.value === d.key)
      if (seg) openSegment(seg, { [axis]: d.key })
    })
    return <BarChartCard data={data} onBarClick={onPick} />
  }

  // Owner axis (D2 shape: owner_id/name → the `owner` param) → bar chart.
  const ownerBars = (segs: CandidateOwnerSegment[]) => {
    const data: ChartDatum[] = segs.map(s => ({ name: s.name, value: s.count, key: s.owner_id }))
    const onPick = gateDrillClick('opportunities', (d: ChartDatum) => {
      const seg = segs.find(s => s.owner_id === d.key)
      if (seg) openSegment({ label: seg.name, count: seg.count }, { owner: d.key })
    })
    return <BarChartCard data={data} onBarClick={onPick} />
  }

  const onSeriesPick = gateDrillClick('opportunities', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // KPI-OPP-1 (CMBE 27-08, commit eb3af985): the strip reads the server's own
  // nine-card kpis[] suite verbatim — mirrors MatchesReport/TasksReport's
  // KPI-MATCHES-1 idiom (kpiByServerKey Map, one predicate shared by value and
  // drill). A key the server omitted (or a pre-suite cached envelope) renders
  // the house dash with no drill — never a value from another population. The
  // stage/customer/owner/branch DATA keeps a chart surface below (donut/bars);
  // forecast_count/forecast_value have no such surface and drop with the strip.
  const kpiByServerKey = new Map((data?.kpis ?? []).map(k => [k.key, k.count]))
  const openKpiDrill = (kpi: string, label: string, value: string | number) =>
    gateDrillClick('opportunities', () => setDrill({
      title: label, value, subtitle: windowSub(), entityPage: 'opportunities',
      rowsEndpoint: '/reports/opportunities/kpis/drill', rowsParams: { ...baseParams, kpi },
    }))
  // Semantic colour only where the number is a SIGNAL and non-zero (§4: colour
  // carries meaning; a calm zero stays uncoloured).
  const KPI_COLOR: Partial<Record<string, string>> = {
    won: 'var(--color-success)', lost: 'var(--color-danger)',
    stale: 'var(--color-warning)', closing_soon: 'var(--color-warning)', overdue: 'var(--color-danger)',
  }
  const SUITE_LABEL_KEY: Record<string, string> = {
    total: 'opportunities.kpi.total', open: 'opportunities.kpi.open', won: 'opportunities.kpi.won',
    lost: 'opportunities.kpi.lost', win_rate: 'opportunities.kpi.winRate', open_value: 'opportunities.kpi.openValue',
    stale: 'opportunities.kpi.stale', closing_soon: 'opportunities.kpi.closingSoon', overdue: 'opportunities.kpi.overdue',
  }
  // UNIT-CANON (FRONTEND-CONTRACT §13, REPORT-KPI-STRIP-1): the SERVER's unit
  // field on each kpis[] entry decides the formatting; the local map is only the
  // tolerant fallback for a cached pre-unit envelope (§10) — never the source.
  const KPI_UNIT_FALLBACK: Partial<Record<string, KpiUnit>> = { win_rate: 'pct', open_value: 'euro' }
  const unitByServerKey = new Map((data?.kpis ?? []).map(k => [k.key, k.unit ?? KPI_UNIT_FALLBACK[k.key]]))
  const openKpiParams = drill?.rowsParams as Record<string, unknown> | undefined
  const kpiByKey: Record<string, KpiSpec> = Object.fromEntries(
    Object.entries(SUITE_LABEL_KEY).map(([key, labelKey]) => {
      const label = t(labelKey)
      const raw = kpiByServerKey.get(key)
      const has = raw != null
      const unit = unitByServerKey.get(key)
      const value = !has ? '—' : unit ? formatKpiUnitValue(raw, unit) : raw
      return [key, {
        key, label, value,
        color: has && raw !== 0 ? KPI_COLOR[key] : undefined,
        active: openKpiParams?.kpi === key,
        // KPI-DREMPELS-FE-1: threshold cards keep their tenant-threshold caption
        // (the envelope still carries the configured day counts).
        sub: key === 'total' && totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" />
          : key === 'stale' && data?.totals?.stale_days != null ? t('thresholdDays', { n: data.totals.stale_days })
          : key === 'closing_soon' && data?.totals?.closing_soon_days != null ? t('thresholdDays', { n: data.totals.closing_soon_days })
          : undefined,
        onClick: has ? openKpiDrill(key, label, value) : undefined,
      } satisfies KpiSpec]
    }))
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('opportunities').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('opportunities')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('opportunities'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* KPI strip — pipeline health, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('opportunities.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently — DD-MM-YYYY (never ISO, §3B). */}
      {!loading && !error && data && (
        <BodyText style={{ fontWeight: 500, marginBottom: 12 }}>
          {t('opportunities.window', { from: formatDate(data.period.from), to: formatDate(data.period.to) })}
        </BodyText>
      )}

      {(!hasData || !data) && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <ReportStateBlock
            loading={loading} error={error} empty={!loading && !error && total === 0}
            loadingLabel={t('opportunities.loading')} errorLabel={t('opportunities.error')} emptyLabel={t('opportunities.empty')}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {hasData && data && (
        <ReportGrid>
          {/* Created over time — week/day timeseries, bucket set server-side. */}
          <ReportChartCard span={2} title={t('opportunities.series')}
            chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />

          {/* Stage axis — a lookup axis with its own colour per value → donut,
              always sums to total ('none' + orphan-uuid rows included). */}
          <ReportChartCard title={t('applications.axes.stage')} chart={stageDonut(data.by_stage)} />

          {/* Top-20 customers + 'others' + 'none' — a ranking axis → bar; a
              hard-deleted customer's "Onbekend" bar still drills on its raw uuid. */}
          <ReportChartCard title={t('applications.axes.customer')} chart={bars('customer', data.by_customer)} />

          <ReportChartCard title={t('customers.axes.owner')} chart={ownerBars(data.by_owner)} />

          {/* Branch axis on the deal's OWN location_id column (unlike vacancies,
              no customer detour) — a ranking axis → bar; drills via the report
              `branch` param. */}
          <ReportChartCard title={t('customers.axes.branch')} chart={bars('branch', data.by_branch)} />
        </ReportGrid>
      )}

      {/* One shared drill drawer for the whole page. */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
