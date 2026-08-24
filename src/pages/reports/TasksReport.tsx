/**
 * TasksReport — tasks report (GET /reports/tasks, RAPPORTEN-SUITE-1 "portie 6").
 * Mirrors OpportunitiesReport 1:1: same envelope family, same calm bars via the
 * shared SegmentBars, the window rendered prominently from the RESPONSE. Drill
 * XOR params follow the seven-way tasks contract: status|type|priority|assignee|
 * team|branch|date (+bucket=week next to a week bar's date). Every axis sums to
 * `total`; status/type/priority key on the LOOKUP ID (never the slug) and their
 * 'none' sentinels + orphan-uuid rows are normal, drillable bars. The KPI strip
 * is display-only: the XOR carries no open/done/overdue segment (no fake
 * affordances — a stat without a real drill path never looks clickable).
 */
import { useState } from 'react'
import { BodyText } from '@/components/ui/typography'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import ReportGrid from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useTasksReport } from './useTasksReport'
import { gateDrillClick } from './reportDrillGate'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import { formatPercent } from '@/lib/formatters'
import type { ReportPeriod, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'
import { getCompareSlug } from './reportCompareSupport'
import { useReportCompare } from './useReportCompare'
import ReportCompareControl from './ReportCompareControl'
import ReportCompareMetric from './ReportCompareMetric'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'

// The plain single-value XOR axes; `assignee` has its own D2 shape below.
type Axis = 'status' | 'type' | 'priority' | 'team' | 'branch'

// Minimal surface the generic bar renderer needs — status rows carry a lookup
// colour, the other axes do not (SegmentBars falls back to the primary tint).
type AxisSeg = { value: string; label: string; count: number; color?: string | null }

export default function TasksReport({ period, filters = EMPTY_REPORT_FILTERS }: { period: ReportPeriod; filters?: ReportFilterState }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useTasksReport(period, filters)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly.
  const compareSlug = getCompareSlug('tasks')
  const [compareMode, setCompareMode] = useState<ReportCompareMode>(COMPARE_OFF)
  const compareBaseParams = { ...buildReportQueryParams(period, 'tasks', filters) }
  const { data: compareData } = useReportCompare(compareSlug, data?.from, data?.to, compareMode, compareBaseParams)
  const totalCompare = compareMode.kind !== 'off' ? (compareData?.total as { current: number; previous: number; delta: number; delta_pct: number | null } | undefined) : undefined

  // One shared drawer for the whole page — a KPI-card click and an axis/bucket
  // click both open the SAME drawer (replacing whatever was open before). Exactly
  // one XOR param per open drill — ALWAYS layered on top of the report's own
  // active filters (`baseParams`), never just `period`, so the drawer counts the
  // exact same set the bar was drawn from.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const baseParams = buildReportQueryParams(period, 'tasks', filters)
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrill({
      title: seg.label, value: seg.count, subtitle: windowSub(),
      rowsEndpoint: '/reports/tasks/drill', rowsParams: { ...baseParams, ...xorParam },
      adviceEndpoint: '/reports/tasks/advice', adviceParams: { ...baseParams, ...xorParam },
    })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/tasks/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/tasks/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  })

  // Generic axis-bar renderer: 'none' sentinels and orphaned (deleted-lookup)
  // values are all normal array entries — each drills on its RAW value (the
  // lookup ID for status/type/priority, never a slug), exactly like any other
  // segment (no special-casing, see SegmentBars).
  const bars = (axis: Axis, segs: AxisSeg[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('tasks', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color ?? null }))} />
  }

  // Assignee axis (D2 shape: owner_id/name → the `assignee` param; a NULL
  // assignee arrives as the 'none' row, "Niet toegewezen").
  const assigneeBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('tasks', (value: string) => {
      const seg = segs.find(s => s.owner_id === value)
      if (seg) openSegment({ label: seg.name, count: seg.count }, { assignee: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('tasks', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // RAPPORT-KAARTDRILLS-1 → Opus-REJECT gemeten: alle vier de eerder bedrade
  // koppels paren een GEWINDOWD kaartgetal (envelope/summary) aan een
  // ONGEWINDOWDE of anders-gedefinieerde server-kpi (total=all-time, open=
  // ongewindowd, done/overdue idem — TasksReport.php documenteert de splitsing
  // zelf). Tot dit rapport zijn kaartWAARDEN uit de server-kpis[]-strip leest
  // (rapportenplan-uitrol, het whatsapp/applications-patroon) blijft deze map
  // LEEG: liever geen kaartdrill dan een lade met andere rijen dan het getal.
  const KPI_DRILL_KEY: Partial<Record<string, string>> = {}
  const openKpiDrill = (localKey: string, label: string, value: string | number) => {
    const serverKey = KPI_DRILL_KEY[localKey]
    if (!serverKey) return undefined
    return gateDrillClick('tasks', () => setDrill({
      title: label, value, subtitle: windowSub(),
      rowsEndpoint: '/reports/tasks/kpis/drill', rowsParams: { ...baseParams, kpi: serverKey },
    }))
  }

  // Workload KPI strip from the envelope's flag-driven summary. Display-only
  // today: the card→kpi drill map above is deliberately EMPTY (windowed card
  // numbers vs unwindowed server keys — see the map's own comment); the cards
  // regain their drill when the strip migrates onto the server kpis[] values.
  const s = data?.summary
  const unassigned = data?.by_assignee.find(seg => seg.owner_id === 'none')
  const noTeam = data?.by_team.find(seg => seg.value === 'none')
  const noBranch = data?.by_branch.find(seg => seg.value === 'none')
  const overdueRate = data && total > 0 && s ? (s.overdue / total) * 100 : null
  // Spare-card sources (REPORTS-KPI-SPARE-1): the top real segment of each axis
  // already rendered below, excluding the 'none' bucket (that is its own card
  // already — unassigned/noTeam/noBranch) — same "biggest real value" rule as
  // vacancies' topIndustry/topOwner. Clicking reuses the page's own openSegment.
  const topRealSeg = <T extends { value: string; count: number; label: string }>(segs: T[]) =>
    segs.filter(x => x.value !== 'none').sort((a, b) => b.count - a.count)[0]
  const topStatus = topRealSeg(data?.by_status ?? [])
  const topType = topRealSeg(data?.by_type ?? [])
  const topPriority = topRealSeg(data?.by_priority ?? [])
  const topAssignee = (data?.by_assignee ?? []).filter(a => a.owner_id !== 'none').sort((a, b) => b.count - a.count)[0]
  const kpiByKey: Record<string, KpiSpec> = {
    total:    { key: 'total',    label: t('tasks.total'),            value: total,
      sub: totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" /> : undefined,
      onClick: openKpiDrill('total', t('tasks.total'), total) },
    open:     { key: 'open',     label: t('tasks.summary.open'),     value: s?.open ?? 0,
      onClick: openKpiDrill('open', t('tasks.summary.open'), s?.open ?? 0) },
    done:     { key: 'done',     label: t('tasks.summary.done'),     value: s?.done ?? 0,
      onClick: openKpiDrill('done', t('tasks.summary.done'), s?.done ?? 0) },
    overdue:  { key: 'overdue',  label: t('tasks.summary.overdue'),  value: s?.overdue ?? 0,
      onClick: openKpiDrill('overdue', t('tasks.summary.overdue'), s?.overdue ?? 0) },
    doneRate: { key: 'doneRate', label: t('tasks.summary.doneRate'),
      value: formatPercent(s?.done_rate) },
    unassigned: { key: 'unassigned', label: t('tasks.unassigned'), value: unassigned?.count ?? 0,
      active: (drill?.rowsParams as Record<string, unknown> | undefined)?.assignee === 'none',
      onClick: unassigned ? gateDrillClick('tasks', () => openSegment({ label: unassigned.name, count: unassigned.count }, { assignee: 'none' })) : undefined },
    noTeam: { key: 'noTeam', label: t('tasks.noTeam'), value: noTeam?.count ?? 0,
      active: (drill?.rowsParams as Record<string, unknown> | undefined)?.team === 'none',
      onClick: noTeam ? gateDrillClick('tasks', () => openSegment(noTeam, { team: 'none' })) : undefined },
    noBranch: { key: 'noBranch', label: t('tasks.noBranch'), value: noBranch?.count ?? 0,
      active: (drill?.rowsParams as Record<string, unknown> | undefined)?.branch === 'none',
      onClick: noBranch ? gateDrillClick('tasks', () => openSegment(noBranch, { branch: 'none' })) : undefined },
    overdueRate: { key: 'overdueRate', label: t('tasks.overdueRate'),
      value: formatPercent(overdueRate) },
    // Spares (REPORTS-KPI-SPARE-1): see topRealSeg above.
    topStatus: { key: 'topStatus', label: t('tasks.summary.topStatus'),
      value: topStatus ? `${topStatus.label} · ${topStatus.count}` : '—',
      onClick: topStatus ? gateDrillClick('tasks', () => openSegment(topStatus, { status: topStatus.value })) : undefined },
    topType: { key: 'topType', label: t('tasks.summary.topType'),
      value: topType ? `${topType.label} · ${topType.count}` : '—',
      onClick: topType ? gateDrillClick('tasks', () => openSegment(topType, { type: topType.value })) : undefined },
    topPriority: { key: 'topPriority', label: t('tasks.summary.topPriority'),
      value: topPriority ? `${topPriority.label} · ${topPriority.count}` : '—',
      onClick: topPriority ? gateDrillClick('tasks', () => openSegment(topPriority, { priority: topPriority.value })) : undefined },
    topAssignee: { key: 'topAssignee', label: t('tasks.summary.topAssignee'),
      value: topAssignee ? `${topAssignee.name} · ${topAssignee.count}` : '—',
      onClick: topAssignee ? gateDrillClick('tasks', () => openSegment({ label: topAssignee.name, count: topAssignee.count }, { assignee: topAssignee.owner_id })) : undefined },
  }
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('tasks').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('tasks')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('tasks'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly. */}
      {hasData && compareSlug && (
        <div style={{ marginBottom: 10 }}>
          <ReportCompareControl mode={compareMode} onChange={setCompareMode} />
        </div>
      )}

      {/* KPI strip — workload health, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('tasks.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). */}
      {!loading && !error && data && (
        <BodyText as="div" style={{ fontWeight: 500, marginBottom: 12 }}>
          {t('tasks.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </BodyText>
      )}

      {(!hasData || !data) && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <ReportStateBlock
            loading={loading} error={error} empty={!loading && !error && total === 0}
            loadingLabel={t('tasks.loading')} errorLabel={t('tasks.error')} emptyLabel={t('tasks.empty')}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {hasData && data && (
        <ReportGrid>
          {/* Created over time — week/day timeseries, bucket set server-side. */}
          <ReportChartCard span={2} title={t('tasks.series')}
            chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />

          {/* Status axis — ID-keyed (slug is not unique-protected); always sums
              to total ('none' folding + orphan-uuid rows included). */}
          <ReportChartCard title={t('tasks.axes.status')} chart={bars('status', data.by_status)} />
          <ReportChartCard title={t('tasks.axes.type')} chart={bars('type', data.by_type)} />
          <ReportChartCard title={t('tasks.axes.priority')} chart={bars('priority', data.by_priority)} />
          <ReportChartCard title={t('tasks.axes.assignee')} chart={assigneeBars(data.by_assignee)} />
          <ReportChartCard title={t('tasks.axes.team')} chart={bars('team', data.by_team)} />
          <ReportChartCard title={t('tasks.axes.branch')} chart={bars('branch', data.by_branch)} />
        </ReportGrid>
      )}

      {/* One shared drill drawer for the whole page. */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
