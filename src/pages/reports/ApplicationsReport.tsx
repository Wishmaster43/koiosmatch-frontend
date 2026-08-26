/**
 * ApplicationsReport — applications INFLOW report (GET /reports/applications,
 * RAPPORTEN-SUITE-1 "portie 2"). Mirrors CandidatesReport 1:1 since RAPPORT-
 * GEZICHT-WAVE2: a chart MIX instead of uniform segment bars — donuts for the
 * coloured/few-value axes (bucket, stage), bar charts for the rankings
 * (source/owner/customer/vacancy), the timeseries line full-width, the stage-
 * duration block keeping its own avg-days face. The window is rendered
 * PROMINENTLY (from/to from the envelope) since this report is windowed on
 * applications.created_at while the applications LIST is not — an invisible
 * window reads as "counts don't match the list" instead of the deliberate split.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, ReportSectionCard, ReportSectionCardBody, ReportSection } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import ReportGrid, { ReportGridItem } from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useApplicationsReport } from './useApplicationsReport'
import { gateDrillClick } from './reportDrillGate'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import SegmentBars from './SegmentBars'
import StatTile from '@/components/ui/StatTile'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { ChartDatum } from '@/components/charts/chartTypes'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import { Caption, BodyText } from '@/components/ui/typography'
import type {
  ReportPeriod, CandidateSegment, CandidateOwnerSegment, CandidateTimeseriesPoint,
  ApplicationTopSegment, ApplicationBucketCounts, ApplicationStageDurationSegment,
} from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'
import { getCompareSlug } from './reportCompareSupport'
import { useReportCompare } from './useReportCompare'
import ReportCompareMetric from './ReportCompareMetric'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'

// The nine fixed KPI keys the live backend returns (ApplicationKpisReport::CARDS,
// RAPPORT-APPS-VERDIEPING-1) in camelCase label form (applications.kpi.*) — the
// server's own `label` is intentionally ignored (§5). Mirrors WhatsappReport's
// KPI_LABEL_KEYS exactly.
const KPI_LABEL_KEYS: Record<string, string> = {
  total: 'applications.kpi.total',
  new: 'applications.kpi.new',
  active: 'applications.kpi.active',
  matched: 'applications.kpi.matched',
  rejected: 'applications.kpi.rejected',
  conversion_pct: 'applications.kpi.conversionPct',
  avg_days_to_match: 'applications.kpi.avgDaysToMatch',
  too_long_in_stage: 'applications.kpi.tooLongInStage',
  missing_appointment: 'applications.kpi.missingAppointment',
}

// The plain axes (single-value XOR param, same shape as CandidatesReport). The
// funnel-bucket axis is handled separately below — its param name ('bucket')
// doubles as the timeseries granularity companion (see the note above openBucket).
type Axis = 'stage' | 'source' | 'customer' | 'vacancy'

// Fixed funnel-bucket vocabulary: flag-driven on the backend, not a tenant lookup,
// so labels come from i18n and colour from the semantic tokens (§4) — never a
// hardcoded hex, and never the lookup-colour path used by the other axes.
const BUCKET_KEYS: (keyof ApplicationBucketCounts)[] = ['active', 'matched', 'rejected', 'placed']
// Deliberate wave-2 deviation: the bucket donut keeps these SEMANTIC tokens
// instead of the default fallback series — the four buckets carry meaning
// (active/matched/rejected/placed) and the replaced bars already wore them.
const BUCKET_COLOR: Record<keyof ApplicationBucketCounts, string> = {
  active: 'var(--color-primary)', matched: 'var(--color-info, var(--color-primary))',
  rejected: 'var(--color-danger)', placed: 'var(--color-success)',
}

// Semantic colour per signal card, non-zero only (§4) — module scope like the
// reference's SUITE_COLOR (never re-allocated per render).
const KPI_COLOR: Partial<Record<string, string>> = {
    rejected: 'var(--color-danger)',
    too_long_in_stage: 'var(--color-warning)', missing_appointment: 'var(--color-warning)',
}

// Merged applications report page (see the module doc above): composes the KPI band, axis charts and drill lade around useApplicationsReport's data.
export default function ApplicationsReport({ period, filters = EMPTY_REPORT_FILTERS, compare = COMPARE_OFF }: { period: ReportPeriod; filters?: ReportFilterState; compare?: ReportCompareMode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { formatNumber } = useNumberFormat()
  const { data, loading, error, refetch } = useApplicationsReport(period, filters)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // RAPPORT-COMPARE-1: year-on-year / period-on-period, reference adoption
  // (§reportCompareSupport.ts) — mirrors CandidatesReport's hosting exactly.
  const compareSlug = getCompareSlug('applications')
  const compareBaseParams = { ...buildReportQueryParams(period, 'applications', filters) }
  const { data: compareData } = useReportCompare(compareSlug, data?.from, data?.to, compare, compareBaseParams)
  const totalCompare = compare.kind !== 'off' ? (compareData?.total as { current: number; previous: number; delta: number; delta_pct: number | null } | undefined) : undefined

  // One shared drawer for the whole page — a KPI-card click and an axis/bucket/
  // timeseries click both open the SAME drawer (replacing whatever was open
  // before), never two independent drill mechanisms.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const baseParams = buildReportQueryParams(period, 'applications', filters)
  const openKpiDrill = (serverKey: string, label: string, value: string | number) =>
    gateDrillClick('applications', () => setDrill({
      title: label, value, subtitle: windowSub(), entityPage: 'applications',
      rowsEndpoint: '/reports/applications/kpis/drill', rowsParams: { ...baseParams, kpi: serverKey },
    }))

  // Every XOR param per open drill is ALWAYS layered on top of the report's own
  // active filters (`baseParams`), never just `period`, so the drawer counts the
  // exact same set the bar was drawn from. Rows are applications with an id, so
  // the drawer deep-links to the application drilldown (§3A entityPage).
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrill({
      title: seg.label, value: seg.count, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
      entityPage: 'applications',
      rowsEndpoint: '/reports/applications/drill', rowsParams: { ...baseParams, ...xorParam },
      adviceEndpoint: '/reports/applications/advice', adviceParams: { ...baseParams, ...xorParam },
    })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    entityPage: 'applications',
    // DUAL ROLE of the `bucket` param (contract note, "portie 2"): here it is the
    // GRANULARITY companion of `date` (day|week — a week bar counts the whole week,
    // so bar and list totals always agree). Below, in bucketDonutData(), `bucket`
    // is instead a FUNNEL segment value (active|matched|rejected|placed) sent
    // WITHOUT `date`. The two value sets never overlap, so the two roles never collide.
    rowsEndpoint: '/reports/applications/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/applications/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  })

  // INTAKE-IN-APPS-1: the intake axis drill (GET /reports/applications/intakes/drill,
  // operation getReportsApplicationsIntakesDrill) — its documented request body only
  // carries axis/value/period/from/to (no status/owner/location/customer filters), so
  // only those fields are sent here, never the full `baseParams` filter set.
  // CONSEQUENCE: the intake bars come from the filter-scoped envelope while this
  // drill cannot be filter-scoped — with an active panel filter the drawer would
  // count a DIFFERENT population than the bar shows, so the bars render without
  // a click while any filter is active (contract gap filed with CMBE:
  // WAVE-1B-CONTRACTVRAGEN-CMBE).
  const openIntakeDrill = (axis: 'state' | 'recruiter' | 'branch', label: string, value: string | number, rawValue: string) =>
    setDrill({
      title: label, value, subtitle: windowSub(),
      rowsEndpoint: '/reports/applications/intakes/drill', rowsParams: { axis, value: rawValue, period },
    })
  // See the CONSEQUENCE note above: intake drills are honest only when no panel
  // filter narrows the envelope this block was drawn from.
  const intakeDrillable = [filters.status, filters.ownerId, filters.locationId, filters.customerId]
    .every(a => a.length === 0)

  // Donut data for a coloured/few-value lookup axis (§chart-type-rule): each
  // slice wears its own tenant colour, falling back to the house series.
  const donutData = (segs: (CandidateSegment | ApplicationTopSegment)[]): { data: ChartDatum[]; colors: string[] } => ({
    data: segs.map(s => ({ name: s.label, value: s.count, key: s.value })),
    colors: segs.map((s, i) => ('color' in s ? s.color : null) ?? CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]),
  })
  const pickSegment = (axis: Axis, segs: (CandidateSegment | ApplicationTopSegment)[]) =>
    gateDrillClick('applications', (d: unknown) => {
      const key = (d as { key?: string })?.key ?? (d as { payload?: { key?: string } })?.payload?.key
      const seg = segs.find(s => s.value === key)
      if (seg) openSegment(seg, { [axis]: seg.value })
    })

  // Bar data for a ranking axis (people/orgs/free values).
  const barData = (segs: (CandidateSegment | ApplicationTopSegment)[]): ChartDatum[] =>
    segs.map(s => ({ name: s.label, value: s.count, key: s.value }))
  const pickBar = (axis: Axis, segs: (CandidateSegment | ApplicationTopSegment)[]) =>
    gateDrillClick('applications', (d: ChartDatum) => {
      const seg = segs.find(s => s.value === d.key)
      if (seg) openSegment(seg, { [axis]: d.key })
    })

  const ownerBarData = (segs: CandidateOwnerSegment[]): ChartDatum[] =>
    segs.map(s => ({ name: s.name, value: s.count, key: s.owner_id }))
  const pickOwnerBar = (segs: CandidateOwnerSegment[]) =>
    gateDrillClick('applications', (d: ChartDatum) => {
      const seg = segs.find(s => s.owner_id === d.key)
      if (seg) openSegment({ label: seg.name, count: seg.count }, { owner: d.key })
    })

  // Funnel-bucket donut: `bucket` here is the SEGMENT value (see the dual-role
  // note above openBucket) — sent without `date`, so it never collides with the
  // granularity role. Only four fixed values, no lookup colour field, so the
  // semantic BUCKET_COLOR map drives the slices.
  const bucketDonutData = (counts: ApplicationBucketCounts): { data: ChartDatum[]; colors: string[] } => ({
    data: BUCKET_KEYS.map(k => ({ name: t(`applications.buckets.${k}`), value: counts[k], key: k })),
    colors: BUCKET_KEYS.map(k => BUCKET_COLOR[k]),
  })
  const pickBucket = (counts: ApplicationBucketCounts) =>
    gateDrillClick('applications', (d: unknown) => {
      const key = (d as { key?: string })?.key ?? (d as { payload?: { key?: string } })?.payload?.key
      const bucketKey = BUCKET_KEYS.find(k => k === key)
      if (bucketKey) openSegment({ label: t(`applications.buckets.${bucketKey}`), count: counts[bucketKey] }, { bucket: bucketKey })
    })

  // FASE-DUUR-1: the "too long in this stage" bars — same stage-key vocabulary as
  // `bars('stage', ...)` but drills through the DIFFERENT `stage_duration` XOR
  // param (backend ApplicationsReport::stageDurationDistribution / drillRows()),
  // never the plain `stage` segment — see the DrillKey comment above.
  const stageDurationBars = (segs: ApplicationStageDurationSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('applications', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { stage_duration: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('applications', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Nine-card KPI strip (RAPPORT-APPS-VERDIEPING-1): straight off the envelope's
  // own `kpis[]` array now — each label from the local i18n catalogue, each card
  // clickable into its own per-KPI drill (whatsapp pattern, no more client-built
  // bucket/axis cards — the server's nine keys supersede them, §0 no fake affordances).
  // Semantic colour per KPI key, applied only when the count is non-zero (§4:
  // colour carries meaning — a calm zero stays uncoloured). Conversion/avg-days
  // are debatable-meaning metrics and stay uncoloured (per brief).
  const kpiByServerKey = new Map((data?.kpis ?? []).map(k => [k.key, k.count]))
  const kpiByKey: Record<string, KpiSpec> = Object.fromEntries(
    Object.entries(KPI_LABEL_KEYS).map(([serverKey, labelKey]) => {
      const camelKey = labelKey.split('.').pop()!
      const raw = kpiByServerKey.get(serverKey)
      // conversion_pct carries a percentage unit, avg_days_to_match a days unit —
      // every other card is a plain count. The house dash renders when NULL
      // (STATS-HONEST-1: nothing decided/matched yet, never a fake 0).
      const value = raw == null ? '—' : serverKey === 'conversion_pct' ? `${formatNumber(raw)}%` : formatNumber(raw)
      const sub = raw != null && serverKey === 'avg_days_to_match' ? t('applications.kpi.daysUnit') : undefined
      const onClick = openKpiDrill(serverKey, t(labelKey), value)
      const color = raw != null && raw !== 0 ? KPI_COLOR[serverKey] : undefined
      return [camelKey, { key: camelKey, label: t(labelKey), value, sub, color, ...(onClick ? { onClick } : {}) }]
    }),
  )

  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored) — mirrors whatsapp.
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('applications').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('applications')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('applications'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  // Total applications rising is unambiguously good, mirrors CandidatesReport.
  if (totalCompare && kpiByKey.total) kpiByKey.total = { ...kpiByKey.total, sub: <ReportCompareMetric metric={totalCompare} polarity="up-good" /> }
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* KPI strip — total inflow, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('applications.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently — DD-MM-YYYY (never ISO, §3B). */}
      {!loading && !error && data && (
        <BodyText as="div" style={{ fontWeight: 500, marginBottom: 12 }}>
          {t('applications.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </BodyText>
      )}

      {(!hasData || !data) && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <ReportStateBlock
            loading={loading} error={error} empty={!loading && !error && total === 0}
            loadingLabel={t('applications.loading')} errorLabel={t('applications.error')} emptyLabel={t('applications.empty')}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {hasData && data && (
        <ReportGrid>
          {/* Inflow over time — week/day timeseries, bucket set server-side. */}
          <ReportChartCard span={2} title={t('applications.series')}
            chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />

          {/* Fixed four-value funnel bucket, no lookup colour → donut with the
              semantic BUCKET_COLOR slices. */}
          <ReportChartCard title={t('applications.axes.bucket')} chart={
            <PieChartCard {...bucketDonutData(data.by_bucket)} onItemClick={pickBucket(data.by_bucket)} />} />
          {/* Funnel stage is a tenant lookup with its own colour → donut. */}
          <ReportChartCard title={t('applications.axes.stage')} chart={
            <PieChartCard {...donutData(data.by_stage)} onItemClick={pickSegment('stage', data.by_stage)} />} />

          {/* Stage-duration keeps its own bars face (renders avg days per
              stage) — a plain donut would lose that number entirely. */}
          <ReportChartCard title={t('applications.axes.stageDuration')} chart={stageDurationBars(data.by_stage_duration)} />

          {/* Rankings (source/owner/customer/vacancy) → bar charts. */}
          <ReportChartCard title={t('applications.axes.source')} chart={
            <BarChartCard data={barData(data.by_source)} onBarClick={pickBar('source', data.by_source)} />} />
          <ReportChartCard title={t('applications.axes.owner')} chart={
            <BarChartCard data={ownerBarData(data.by_owner)} onBarClick={pickOwnerBar(data.by_owner)} />} />
          <ReportChartCard title={t('applications.axes.customer')} chart={
            <BarChartCard data={barData(data.by_customer)} onBarClick={pickBar('customer', data.by_customer)} />} />
          {/* Last odd card spans the full row — no empty grid hole (uitlijning). */}
          <ReportChartCard span={2} title={t('applications.axes.vacancy')} chart={
            <BarChartCard data={barData(data.by_vacancy)} onBarClick={pickBar('vacancy', data.by_vacancy)} />} />

          {/* INTAKE-IN-APPS-1: appointment numbers for the window — two small
              tiles + two distribution axes. GET /reports/applications/intakes/drill
              (operation getReportsApplicationsIntakesDrill, api-generated.ts) covers
              axis state|recruiter|branch — state's value vocabulary is confirmed
              'planned'|'done' (query.value doc comment) so the two tiles now drill
              too, gated by the same intakeDrillable flag as the recruiter/branch bars. */}
          <ReportGridItem span={2}>
            <ReportSectionCard>
              <ReportSectionCardBody>
                <ReportSection title={t('applications.intakes.title')}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <StatTile label={t('applications.intakes.planned')} value={formatNumber(data.intakes.planned)}
                        onClick={intakeDrillable ? gateDrillClick('applications', () =>
                          openIntakeDrill('state', t('applications.intakes.planned'), data.intakes.planned, 'planned')) : undefined} />
                      <StatTile label={t('applications.intakes.doneInPeriod')} value={formatNumber(data.intakes.done_in_period)}
                        onClick={intakeDrillable ? gateDrillClick('applications', () =>
                          openIntakeDrill('state', t('applications.intakes.doneInPeriod'), data.intakes.done_in_period, 'done')) : undefined} />
                    </div>
                    <div>
                      <Caption style={{ fontWeight: 600, marginBottom: 4, display: 'block' }}>{t('applications.intakes.byRecruiter')}</Caption>
                      <SegmentBars
                        max={data.intakes.by_recruiter.reduce((m, s) => Math.max(m, s.count), 0)}
                        items={data.intakes.by_recruiter.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))}
                        onPick={intakeDrillable ? gateDrillClick('applications', (value: string) => {
                          const seg = data.intakes.by_recruiter.find(s => s.owner_id === value)
                          if (seg) openIntakeDrill('recruiter', seg.name, seg.count, seg.owner_id)
                        }) : undefined}
                      />
                    </div>
                    <div>
                      <Caption style={{ fontWeight: 600, marginBottom: 4, display: 'block' }}>{t('applications.intakes.byBranch')}</Caption>
                      <SegmentBars
                        max={data.intakes.by_branch.reduce((m, s) => Math.max(m, s.count), 0)}
                        items={data.intakes.by_branch.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))}
                        onPick={intakeDrillable ? gateDrillClick('applications', (value: string) => {
                          const seg = data.intakes.by_branch.find(s => s.value === value)
                          if (seg) openIntakeDrill('branch', seg.label, seg.count, seg.value)
                        }) : undefined}
                      />
                    </div>
                  </div>
                </ReportSection>
              </ReportSectionCardBody>
            </ReportSectionCard>
          </ReportGridItem>
        </ReportGrid>
      )}

      {/* The shared drill drawer — a KPI card, an axis bar or a timeseries
          bucket all open the SAME drawer instance. */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
