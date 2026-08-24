/**
 * ApplicationsReport — applications INFLOW report (GET /reports/applications,
 * RAPPORTEN-SUITE-1 "portie 2"). Mirrors CandidatesReport 1:1 (same envelope
 * family, same calm hand-rolled bars, no Recharts §3B): the window is rendered
 * PROMINENTLY (from/to from the envelope) since this report is windowed on
 * applications.created_at while the applications LIST is not — an invisible
 * window reads as "counts don't match the list" instead of the deliberate split.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useApplicationsReport } from './useApplicationsReport'
import { gateDrillClick } from './reportDrillGate'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import SegmentBars from './SegmentBars'
import StatTile from '@/components/ui/StatTile'
import ReportChartWithDrillList from './ReportChartWithDrillList'
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

// Every drillable section on this page, each owning its OWN always-visible list
// (ReportChartWithDrillList) — one key per section, never a single global `drill`.
// 'stageDuration' is its OWN key (not folded into 'stage') — same stage-key
// vocabulary, a DIFFERENT XOR param (`stage_duration`, not `stage`) and a
// different predicate (longest-hanging rows, not "currently in this stage").
type DrillKey = Axis | 'owner' | 'bucket' | 'series' | 'stage_duration'

// Fixed funnel-bucket vocabulary: flag-driven on the backend, not a tenant lookup,
// so labels come from i18n and colour from the semantic tokens (§4) — never a
// hardcoded hex, and never the lookup-colour path used by the other axes.
const BUCKET_KEYS: (keyof ApplicationBucketCounts)[] = ['active', 'matched', 'rejected', 'placed']
const BUCKET_COLOR: Record<keyof ApplicationBucketCounts, string> = {
  active: 'var(--color-primary)', matched: 'var(--color-info, var(--color-primary))',
  rejected: 'var(--color-danger)', placed: 'var(--color-success)',
}

export default function ApplicationsReport({ period, filters = EMPTY_REPORT_FILTERS }: { period: ReportPeriod; filters?: ReportFilterState }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { formatNumber } = useNumberFormat()
  const { data, loading, error, refetch } = useApplicationsReport(period, filters)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Per-KPI drill (whatsapp pattern, RAPPORT-APPS-VERDIEPING-1): clicking a strip
  // card opens the shared drawer on GET /reports/applications/kpis/drill?kpi=<key>,
  // layered on top of the report's own active panel filters — never just `period`.
  const [kpiDrill, setKpiDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openKpiDrill = (serverKey: string, label: string, value: string | number) =>
    gateDrillClick('applications', () => setKpiDrill({
      title: label, value, subtitle: windowSub(),
      rowsEndpoint: '/reports/applications/kpis/drill', rowsParams: { ...baseParams, kpi: serverKey },
    }))

  // Drill-down: every axis section, the bucket section and the timeseries own an
  // ALWAYS-VISIBLE list beside their chart (ReportChartWithDrillList) instead of a
  // shared overlay — so one key per section, never a single global `drill`. Exactly
  // one XOR param per open drill — ALWAYS layered on top of the report's own active
  // filters (`baseParams`), never just `period`, so the list counts the exact same
  // set the bar was drawn from.
  const [drills, setDrills] = useState<Partial<Record<DrillKey, DrillSpec>>>({})
  const baseParams = buildReportQueryParams(period, 'applications', filters)
  const openSegment = (key: DrillKey, seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrills(d => ({ ...d, [key]: {
      title: seg.label, value: seg.count, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
      rowsEndpoint: '/reports/applications/drill', rowsParams: { ...baseParams, ...xorParam },
      adviceEndpoint: '/reports/applications/advice', adviceParams: { ...baseParams, ...xorParam },
    } }))
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrills(d => ({ ...d, series: {
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
  } }))

  const bars = (axis: Axis, segs: (CandidateSegment | ApplicationTopSegment)[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('applications', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(axis, seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: 'color' in s ? s.color : null }))} />
  }

  const ownerBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('applications', (value: string) => {
      const seg = segs.find(s => s.owner_id === value)
      if (seg) openSegment('owner', { label: seg.name, count: seg.count }, { owner: value })
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
      if (item) openSegment('bucket', { label: item.label, count: item.count }, { bucket: value })
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
      if (seg) openSegment('stage_duration', seg, { stage_duration: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('applications', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Default each section's list to its own top segment on mount so no panel is
  // ever blank — mirrors clicking that segment's own bar, never a client-side guess.
  useEffect(() => {
    if (!data) return
    const top = <T,>(segs: T[], count: (s: T) => number) => segs.length ? segs.reduce((a, b) => (count(b) > count(a) ? b : a)) : null
    const topStage = top(data.by_stage, s => s.count)
    const topSource = top(data.by_source, s => s.count)
    const topOwner = top(data.by_owner, s => s.count)
    const topCustomer = top(data.by_customer, s => s.count)
    const topVacancy = top(data.by_vacancy, s => s.count)
    const topBucketKey = top(BUCKET_KEYS, k => data.by_bucket[k])
    if (topStage) openSegment('stage', topStage, { stage: topStage.value })
    if (topSource) openSegment('source', topSource, { source: topSource.value })
    if (topOwner) openSegment('owner', { label: topOwner.name, count: topOwner.count }, { owner: topOwner.owner_id })
    if (topCustomer) openSegment('customer', topCustomer, { customer: topCustomer.value })
    if (topVacancy) openSegment('vacancy', topVacancy, { vacancy: topVacancy.value })
    const topStageDuration = top(data.by_stage_duration, s => s.count)
    if (topStageDuration) openSegment('stage_duration', topStageDuration, { stage_duration: topStageDuration.value })
    if (topBucketKey) openSegment('bucket', { label: t(`applications.buckets.${topBucketKey}`), count: data.by_bucket[topBucketKey] }, { bucket: topBucketKey })
    if (data.timeseries.series.length) openBucket(data.timeseries.series[data.timeseries.series.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.from, data?.to])

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

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && total === 0}
          loadingLabel={t('applications.loading')} errorLabel={t('applications.error')} emptyLabel={t('applications.empty')}
          onRetry={() => refetch()}
        />
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Inflow over time — week/day timeseries, bucket set server-side. Its own
                always-visible list sits beside it, never a shared overlay. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.series')}</h3>
              <ReportChartWithDrillList drill={drills.series ?? null} placeholderLabel={t('applications.series')}
                chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.bucket')}</h3>
              <ReportChartWithDrillList drill={drills.bucket ?? null} placeholderLabel={t('applications.axes.bucket')}
                chart={bucketBars(data.by_bucket)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.stage')}</h3>
              <ReportChartWithDrillList drill={drills.stage ?? null} placeholderLabel={t('applications.axes.stage')}
                chart={bars('stage', data.by_stage)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.stageDuration')}</h3>
              <ReportChartWithDrillList drill={drills.stage_duration ?? null} placeholderLabel={t('applications.axes.stageDuration')}
                chart={stageDurationBars(data.by_stage_duration)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.source')}</h3>
              <ReportChartWithDrillList drill={drills.source ?? null} placeholderLabel={t('applications.axes.source')}
                chart={bars('source', data.by_source)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.owner')}</h3>
              <ReportChartWithDrillList drill={drills.owner ?? null} placeholderLabel={t('applications.axes.owner')}
                chart={ownerBars(data.by_owner)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.customer')}</h3>
              <ReportChartWithDrillList drill={drills.customer ?? null} placeholderLabel={t('applications.axes.customer')}
                chart={bars('customer', data.by_customer)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.vacancy')}</h3>
              <ReportChartWithDrillList drill={drills.vacancy ?? null} placeholderLabel={t('applications.axes.vacancy')}
                chart={bars('vacancy', data.by_vacancy)} />
            </section>

            {/* INTAKE-IN-APPS-1: appointment numbers for the window — two small
                tiles + two distribution axes. Not clickable: the backend offers no
                intake drill (only /reports/applications/kpis/drill exists), so no
                affordance is drawn on top of these (§3 no fake affordances). */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.intakes.title')}</h3>
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
                  />
                </div>
                <div>
                  <Caption style={{ fontWeight: 600, marginBottom: 4, display: 'block' }}>{t('applications.intakes.byBranch')}</Caption>
                  <SegmentBars
                    max={data.intakes.by_branch.reduce((m, s) => Math.max(m, s.count), 0)}
                    items={data.intakes.by_branch.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))}
                  />
                </div>
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
