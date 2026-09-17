/**
 * TasksReport — tasks report (GET /reports/tasks, RAPPORTEN-SUITE-1 "portie 6").
 * Mirrors CandidatesReport 1:1 since RAPPORT-GEZICHT-WAVE2: a chart MIX instead
 * of uniform segment bars — donuts for the coloured/few-value axes (status,
 * priority), bar charts for the rankings (type/assignee/team/branch), the
 * window rendered prominently from the RESPONSE. Drill XOR params follow the
 * seven-way tasks contract: status|type|priority|assignee|team|branch|date
 * (+bucket=week next to a week bar's date). Every axis sums to `total`;
 * status/type/priority key on the LOOKUP ID (never the slug) and their 'none'
 * sentinels + orphan-uuid rows are normal, drillable segments. The KPI strip
 * is display-only: the XOR carries no open/done/overdue segment (no fake
 * affordances — a stat without a real drill path never looks clickable).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import ReportGrid from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useTasksReport } from './useTasksReport'
import { gateDrillClick } from './reportDrillGate'
import { useSeriesDrill } from './hooks/useSeriesDrill'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateOwnerSegment } from '@/types/analytics'
import { useOrderedReportKpis } from './hooks/useOrderedReportKpis'
import { useReportCompareData } from './hooks/useReportCompareData'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'
import { ReportStateFlow } from './components/ReportStateFlow'
import { ReportDataWindow } from './components/ReportDataWindow'
import { donutData, barData, ownerBarData } from './lib/chartData'
import { serverKpiSpecs } from './lib/kpiSpecs'
import { makeOpenKpiDrill, makeOpenSegment } from './lib/drillFactories'
import { totalCompareSubFor } from './lib/kpiCompareSub'
import { segmentClick, ownerClick } from './lib/drillClick'
import { reportWindowLabel } from './lib/reportWindowLabel'
import { useReportCustomKpis } from './hooks/useReportCustomKpis'

// The plain single-value XOR axes; `assignee` has its own D2 shape below.
type Axis = 'status' | 'type' | 'priority' | 'team' | 'branch'

// Minimal surface the generic bar renderer needs — status rows carry a lookup
// colour, the other axes do not (SegmentBars falls back to the primary tint).
type AxisSeg = { value: string; label: string; count: number; color?: string | null }

// See the file's top doc above for the chart-mix rule and the seven-way drill contract this report renders against.
export default function TasksReport({ period, filters = EMPTY_REPORT_FILTERS, compare = COMPARE_OFF }: { period: ReportPeriod; filters?: ReportFilterState; compare?: ReportCompareMode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useTasksReport(period, filters)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly.
  const { totalCompare } = useReportCompareData(period, 'tasks', filters, data, compare)

  // One shared drawer for the whole page — a KPI-card click and an axis/bucket
  // click both open the SAME drawer (replacing whatever was open before). Exactly
  // one XOR param per open drill — ALWAYS layered on top of the report's own
  // active filters (`baseParams`), never just `period`, so the drawer counts the
  // exact same set the bar was drawn from.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => reportWindowLabel(formatDate, data?.from, data?.to)
  const baseParams = buildReportQueryParams(period, 'tasks', filters)
  // Rows are tasks with an id, so the drawer deep-links to the task drilldown
  // (§3A entityPage).
  const openSegment = makeOpenSegment({ entityPage: 'tasks', rowsEndpoint: '/reports/tasks/drill', adviceEndpoint: '/reports/tasks/advice', baseParams, windowSub, setDrill })

  // Donut data for a coloured/few-value axis (§chart-type-rule): each slice
  // wears its own tenant colour, falling back to the house series. 'none'
  // sentinels and orphaned (deleted-lookup) values are normal entries — each
  // drills on its RAW value (the lookup ID for status/priority, never a slug).
  const pickSegment = (axis: Axis, segs: AxisSeg[]) =>
    gateDrillClick('tasks', segmentClick(segs, axis, openSegment))

  // Bar data for a ranking axis (open vocabulary / people / orgs).
  const pickBar = (axis: Axis, segs: AxisSeg[]) =>
    gateDrillClick('tasks', segmentClick(segs, axis, openSegment))

  // Assignee axis (D2 shape: owner_id/name → the `assignee` param; a NULL
  // assignee arrives as the 'none' row, "Niet toegewezen").
  const assigneeBarData = ownerBarData
  const pickAssigneeBar = (segs: CandidateOwnerSegment[]) =>
    gateDrillClick('tasks', ownerClick(segs, openSegment, 'assignee'))

  // Series pick via extracted hook.
  const { onSeriesPick } = useSeriesDrill('tasks', data, baseParams, windowSub, setDrill, 'tasks')

  // KPI-TAKEN-1 (naronde wave 1b): the nine-card strip reads the server's own
  // kpis[] suite verbatim — value and drawer share ONE backend predicate per key
  // (BuildsTaskKpis/kpiSegmentQuery), so a card's number and its drill rows can
  // never diverge. A key the server omitted (or a pre-suite cached envelope)
  // renders the house dash with no drill — never a value from another
  // population (the old summary-based cards paired the is_done flag with
  // completed_at drills, the exact mismatch that got this strip rejected).
  // The drill accepts the full panel-filter vocabulary (measured:
  // getReportsTasksKpisDrill), so baseParams rides along like the axis drills.
  const openKpiDrill = makeOpenKpiDrill({ report: 'tasks', rowsEndpoint: '/reports/tasks/kpis/drill', baseParams, windowSub, setDrill })
  // Semantic colour only where the number is a SIGNAL and non-zero (§4: colour
  // carries meaning; a calm zero stays uncoloured).
  const KPI_COLOR: Partial<Record<string, string>> = {
    overdue: 'var(--color-danger)', due_today: 'var(--color-warning)',
    due_this_week: 'var(--color-warning)', without_assignee: 'var(--color-warning)',
    done_in_period: 'var(--color-success)',
  }
  const SUITE_LABEL_KEY: Record<string, string> = {
    total: 'tasks.kpi.total', open: 'tasks.kpi.open', overdue: 'tasks.kpi.overdue',
    done_in_period: 'tasks.kpi.doneInPeriod', created_in_period: 'tasks.kpi.createdInPeriod',
    due_today: 'tasks.kpi.dueToday', due_this_week: 'tasks.kpi.dueThisWeek',
    without_assignee: 'tasks.kpi.withoutAssignee', avg_completion_days: 'tasks.kpi.avgCompletionDays',
  }
  const kpiByKey = serverKpiSpecs({
    data, drill, labelKeys: SUITE_LABEL_KEY, colors: KPI_COLOR, t, openKpiDrill,
    // avg_completion_days is a computed average in days, not a row count.
    valueFor: (key, raw, has) => (!has ? '—' : key === 'avg_completion_days' ? t('tasks.kpi.daysValue', { days: Math.round(raw as number) }) : (raw as number)),
    subFor: totalCompareSubFor(totalCompare),
  })
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const { kpis, fellBack } = useOrderedReportKpis('tasks', kpiByKey)

  // KPI-BUILDER-FE-1: tenant-defined KPI cards ride a second band row, opening
  // the shared definition-drill route (never `kpi`/`date`/`phase_filter`).
  const { customKpis, extraTitle: customKpiTitle } = useReportCustomKpis({
    data, drill, baseParams, windowSub, setDrill, entityPage: 'tasks',
  })

  return (
    <div>
      {/* KPI strip — workload health, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} extraKpis={customKpis} extraTitle={customKpiTitle}
          notice={fellBack ? t('tasks.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). */}
      {!loading && !error && data && (
        <ReportDataWindow
          from={formatDate(data.from)}
          to={formatDate(data.to)}
          reportKey="tasks"
          totalCompare={totalCompare}
        />
      )}

      <ReportStateFlow
        loading={loading}
        error={error}
        empty={!loading && !error && total === 0}
        loadingLabel={t('tasks.loading')}
        errorLabel={t('tasks.error')}
        emptyLabel={t('tasks.empty')}
        onRetry={() => refetch()}
      />

      {hasData && data && (
        <ReportGrid>
          {/* Created over time — week/day timeseries, bucket set server-side. */}
          <ReportChartCard span={2} title={t('tasks.series')}
            chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />

          {/* Status carries a tenant lookup colour, ID-keyed (slug is not
              unique-protected); always sums to total ('none' folding +
              orphan-uuid rows included) → donut. */}
          <ReportChartCard title={t('tasks.axes.status')} chart={
            <PieChartCard {...donutData(data.by_status)} onItemClick={pickSegment('status', data.by_status)} />} />
          {/* Priority is a small, closed vocabulary → donut (fallback series,
              no lookup colour field). */}
          <ReportChartCard title={t('tasks.axes.priority')} chart={
            <PieChartCard {...donutData(data.by_priority)} onItemClick={pickSegment('priority', data.by_priority)} />} />

          {/* Rankings (type/assignee/team/branch) → bar charts. */}
          <ReportChartCard title={t('tasks.axes.type')} chart={
            <BarChartCard data={barData(data.by_type)} onBarClick={pickBar('type', data.by_type)} />} />
          <ReportChartCard title={t('tasks.axes.assignee')} chart={
            <BarChartCard data={assigneeBarData(data.by_assignee)} onBarClick={pickAssigneeBar(data.by_assignee)} />} />
          <ReportChartCard title={t('tasks.axes.team')} chart={
            <BarChartCard data={barData(data.by_team)} onBarClick={pickBar('team', data.by_team)} />} />
          <ReportChartCard title={t('tasks.axes.branch')} chart={
            <BarChartCard data={barData(data.by_branch)} onBarClick={pickBar('branch', data.by_branch)} />} />
        </ReportGrid>
      )}

      {/* One shared drill drawer for the whole page. DRY: mirrors CandidatesReport's
          own tail (ReportChartCard/BarChartCard/ReportDrillDrawer are already the
          shared atoms) — the per-page axis set/labels are real report content,
          not a copy to merge. */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
