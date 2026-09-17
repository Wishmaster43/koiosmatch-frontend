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
import ReportGrid from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useOpportunitiesReport } from './useOpportunitiesReport'
import { gateDrillClick } from './reportDrillGate'
import { useSeriesDrill } from './hooks/useSeriesDrill'
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateOwnerSegment } from '@/types/analytics'
import { useOrderedReportKpis } from './hooks/useOrderedReportKpis'
import { useTotalCompare } from './hooks/useTotalCompare'
import { getCompareSlug } from './reportCompareSupport'
import { totalCompareSubFor } from './lib/kpiCompareSub'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import { unitAwareServerKpiSpecs, thresholdCaption } from './lib/kpiSpecs'
import { donutData, barData, ownerBarData } from './lib/chartData'
import { segmentClick, ownerClick } from './lib/drillClick'
import { ReportStateFlow } from './components/ReportStateFlow'
import { ReportDataWindow } from './components/ReportDataWindow'
import { reportWindowLabel } from './lib/reportWindowLabel'
import { makeOpenKpiDrill, makeOpenSegment } from './lib/drillFactories'
import { useReportCustomKpis } from './hooks/useReportCustomKpis'

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
  const totalCompare = useTotalCompare(compareSlug, data?.period.from, data?.period.to, compare, { period })

  // Drill-down: one shared drawer for the whole page — a segment/bucket click
  // opens it fresh, replacing whatever was open before. Exactly one XOR param
  // per open drill.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => reportWindowLabel(formatDate, data?.period.from, data?.period.to)
  // Every drill (axis segment, bucket, KPI card) layers on top of the report's own
  // active panel filters (status/owner/branch/customer + value_min/value_max),
  // never just `period` — mirrors VacanciesReport's baseParams so bar and drawer
  // total always agree on the same underlying set. buildReportQueryParams already
  // attaches value_min/value_max for 'opportunities' (reportFilterParams.ts).
  const baseParams = buildReportQueryParams(period, 'opportunities', filters)
  // K-192: advice validates the panel filters exactly like the drill (see
  // getReportsOpportunitiesAdvice, api-generated.ts:46593 — owner_id/location_id/
  // status/customer_id/value_min/value_max all listed) — so advice and drawer
  // rows share one population. baseParams already carries period.
  const openSegment = makeOpenSegment({ entityPage: 'opportunities', rowsEndpoint: '/reports/opportunities/drill', adviceEndpoint: '/reports/opportunities/advice', baseParams, windowSub, setDrill })

  // Stage axis: a lookup axis with its own colour per value (CHART-TYPE RULE) →
  // donut. 'none'/'others' sentinels and orphaned (deleted-lookup) values are
  // all normal array entries — each slice drills on its RAW value.
  const stageDonut = (segs: AxisSeg[]) =>
    <PieChartCard {...donutData(segs)} onItemClick={gateDrillClick('opportunities', segmentClick(segs, 'stage', openSegment))} />

  // Ranking axes (customer/branch: people/orgs, no lookup colour) → bar chart.
  const bars = (axis: Exclude<Axis, 'stage'>, segs: AxisSeg[]) =>
    <BarChartCard data={barData(segs)} onBarClick={gateDrillClick('opportunities', segmentClick(segs, axis, openSegment))} />

  // Owner axis (D2 shape: owner_id/name → the `owner` param) → bar chart.
  const ownerBars = (segs: CandidateOwnerSegment[]) =>
    <BarChartCard data={ownerBarData(segs)} onBarClick={gateDrillClick('opportunities', ownerClick(segs, openSegment))} />

  // Series pick via extracted hook.
  const { onSeriesPick } = useSeriesDrill('opportunities', data, baseParams, windowSub, setDrill)

  // KPI-OPP-1 (CMBE 27-08, commit eb3af985): the strip reads the server's own
  // nine-card kpis[] suite verbatim — mirrors MatchesReport/TasksReport's
  // KPI-MATCHES-1 idiom (the server-keyed Map serverKpiSpecs builds, one predicate shared by value and
  // drill). A key the server omitted (or a pre-suite cached envelope) renders
  // the house dash with no drill — never a value from another population. The
  // stage/customer/owner/branch DATA keeps a chart surface below (donut/bars);
  // forecast_count/forecast_value have no such surface and drop with the strip.
  const openKpiDrill = makeOpenKpiDrill({ report: 'opportunities', rowsEndpoint: '/reports/opportunities/kpis/drill', baseParams, windowSub, setDrill })
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
  const kpiByKey = unitAwareServerKpiSpecs({
    data, drill, labelKeys: SUITE_LABEL_KEY, colors: KPI_COLOR, t, openKpiDrill,
    unitFallback: { win_rate: 'pct', open_value: 'euro' },
    // KPI-DREMPELS-FE-1: threshold cards keep their tenant-threshold caption
    // (the envelope still carries the configured day counts).
    subFor: key => totalCompareSubFor(totalCompare)(key)
      ?? thresholdCaption(t, key, { stale: data?.totals?.stale_days, closing_soon: data?.totals?.closing_soon_days }),
  })
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const { kpis, fellBack } = useOrderedReportKpis('opportunities', kpiByKey)

  // KPI-BUILDER-FE-1: tenant-defined KPI cards ride a second band row, opening
  // the shared definition-drill route (never `kpi`/`date`/`phase_filter`); the
  // shared hook also renames this page's own `customer_id[]` to the route's
  // `customer_ids[]` so card and drawer keep one population.
  const { customKpis, extraTitle: customKpiTitle } = useReportCustomKpis({
    data, drill, baseParams, windowSub, setDrill, entityPage: 'opportunities',
  })

  return (
    <div>
      {/* KPI strip — pipeline health, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} extraKpis={customKpis} extraTitle={customKpiTitle}
          notice={fellBack ? t('opportunities.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently — DD-MM-YYYY (never ISO, §3B). */}
      {!loading && !error && data && (
        <ReportDataWindow
          from={formatDate(data.period.from)}
          to={formatDate(data.period.to)}
          reportKey="opportunities"
          totalCompare={totalCompare}
        />
      )}

      <ReportStateFlow
        loading={loading}
        error={error}
        empty={!loading && !error && total === 0}
        loadingLabel={t('opportunities.loading')}
        errorLabel={t('opportunities.error')}
        emptyLabel={t('opportunities.empty')}
        onRetry={() => refetch()}
      />

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
