/**
 * ApplicationsReport — applications INFLOW report (GET /reports/applications,
 * RAPPORTEN-SUITE-1 "portie 2"). Mirrors CandidatesReport 1:1 (same envelope
 * family, same calm hand-rolled bars, no Recharts §3B): the window is rendered
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
const BUCKET_COLOR: Record<keyof ApplicationBucketCounts, string> = {
  active: 'var(--color-primary)', matched: 'var(--color-info, var(--color-primary))',
  rejected: 'var(--color-danger)', placed: 'var(--color-success)',
}

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
      title: label, value, subtitle: windowSub(),
      rowsEndpoint: '/reports/applications/kpis/drill', rowsParams: { ...baseParams, kpi: serverKey },
    }))

  // Every XOR param per open drill is ALWAYS layered on top of the report's own
  // active filters (`baseParams`), never just `period`, so the drawer counts the
  // exact same set the bar was drawn from.
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrill({
      title: seg.label, value: seg.count, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
      rowsEndpoint: '/reports/applications/drill', rowsParams: { ...baseParams, ...xorParam },
      adviceEndpoint: '/reports/applications/advice', adviceParams: { ...baseParams, ...xorParam },
    })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    // DUAL ROLE of the `bucket` param (contract note, "portie 2"): here it is the
    // GRANULARITY companion of `date` (day|week — a week bar counts the whole week,
    // so bar and list totals always agree). Below, in bucketBars(), `bucket` is
    // instead a FUNNEL segment value (active|matched|rejected|placed) sent WITHOUT
    // `date`. The two value sets never overlap, so the two roles never collide.
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

  const bars = (axis: Axis, segs: (CandidateSegment | ApplicationTopSegment)[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('applications', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: 'color' in s ? s.color : null }))} />
  }

  const ownerBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('applications', (value: string) => {
      const seg = segs.find(s => s.owner_id === value)
      if (seg) openSegment({ label: seg.name, count: seg.count }, { owner: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))} />
  }

  // Funnel-bucket bars: `bucket` here is the SEGMENT value (see the dual-role note
  // above openBucket) — sent without `date`, so it never collides with the
  // granularity role.
  const bucketBars = (counts: ApplicationBucketCounts) => {
    const items = BUCKET_KEYS.map(k => ({ key: k, label: t(`applications.buckets.${k}`), count: counts[k], color: BUCKET_COLOR[k] }))
    const max = items.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('applications', (value: string) => {
      const item = items.find(s => s.key === value)
      if (item) openSegment({ label: item.label, count: item.count }, { bucket: value })
    })
    return <SegmentBars max={max} onPick={onPick} items={items} />
  }

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
      return [camelKey, { key: camelKey, label: t(labelKey), value, sub, ...(onClick ? { onClick } : {}) }]
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

          <ReportChartCard title={t('applications.axes.bucket')} chart={bucketBars(data.by_bucket)} />
          <ReportChartCard title={t('applications.axes.stage')} chart={bars('stage', data.by_stage)} />
          <ReportChartCard title={t('applications.axes.stageDuration')} chart={stageDurationBars(data.by_stage_duration)} />
          <ReportChartCard title={t('applications.axes.source')} chart={bars('source', data.by_source)} />
          <ReportChartCard title={t('applications.axes.owner')} chart={ownerBars(data.by_owner)} />
          <ReportChartCard title={t('applications.axes.customer')} chart={bars('customer', data.by_customer)} />
          <ReportChartCard title={t('applications.axes.vacancy')} chart={bars('vacancy', data.by_vacancy)} />

          {/* INTAKE-IN-APPS-1: appointment numbers for the window — two small
              tiles + two distribution axes. GET /reports/applications/intakes/drill
              (operation getReportsApplicationsIntakesDrill) now covers axis
              recruiter|branch|state — the recruiter/branch bars below drill on it.
              The planned/done tiles stay display-only: axis=state's value
              vocabulary is unconfirmed (asked CMBE) — no guessing 'planned'/'done'. */}
          <ReportGridItem span={2}>
            <ReportSectionCard>
              <ReportSectionCardBody>
                <ReportSection title={t('applications.intakes.title')}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <StatTile label={t('applications.intakes.planned')} value={formatNumber(data.intakes.planned)} />
                      <StatTile label={t('applications.intakes.doneInPeriod')} value={formatNumber(data.intakes.done_in_period)} />
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
