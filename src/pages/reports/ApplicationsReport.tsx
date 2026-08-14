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
import type { DrillSpec } from './ReportDrillDrawer'
import { useApplicationsReport } from './useApplicationsReport'
import { gateDrillClick } from './reportDrillGate'
import { buildAxisKpis } from './buildAxisKpis'
import type { AxisKpiConfig } from './buildAxisKpis'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import SegmentBars from './SegmentBars'
import ReportChartWithDrillList from './ReportChartWithDrillList'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type {
  ReportPeriod, CandidateSegment, CandidateOwnerSegment, CandidateTimeseriesPoint,
  ApplicationTopSegment, ApplicationBucketCounts,
} from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

// The plain axes (single-value XOR param, same shape as CandidatesReport). The
// funnel-bucket axis is handled separately below — its param name ('bucket')
// doubles as the timeseries granularity companion (see the note above openBucket).
type Axis = 'stage' | 'source' | 'customer' | 'vacancy'

// Every drillable section on this page, each owning its OWN always-visible list
// (ReportChartWithDrillList) — one key per section, never a single global `drill`.
type DrillKey = Axis | 'owner' | 'bucket' | 'series'

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
  const { data, loading, error, refetch } = useApplicationsReport(period, filters)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

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
    if (topBucketKey) openSegment('bucket', { label: t(`applications.buckets.${topBucketKey}`), count: data.by_bucket[topBucketKey] }, { bucket: topBucketKey })
    if (data.timeseries.series.length) openBucket(data.timeseries.series[data.timeseries.series.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.from, data?.to])

  // Nine-card KPI strip (same footprint as the dashboard): total + the four fixed
  // funnel-bucket counts (real, flag-driven, already on the response) + the top
  // segment of four more axes (stage/source/owner/customer) — all real counts,
  // nothing invented (§0 no fake affordances). `vacancy` stays out of the strip
  // (top-20+others is a weak "top KPI" pick) but is still fully shown as bars below.
  const bucketKpis: KpiSpec[] = BUCKET_KEYS.map(k => ({
    key: `bucket:${k}`, label: `${t('applications.axes.bucket')}: ${t(`applications.buckets.${k}`)}`, value: data?.by_bucket[k] ?? 0,
    active: (drills.bucket?.rowsParams as Record<string, unknown> | undefined)?.bucket === k,
    onClick: gateDrillClick('applications', () => openSegment('bucket', { label: t(`applications.buckets.${k}`), count: data?.by_bucket[k] ?? 0 }, { bucket: k })),
  }))
  const allAxisConfigs: Record<string, AxisKpiConfig> = {
    stage:    { axis: 'stage',    axisLabel: t('applications.axes.stage'),    segs: (data?.by_stage ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    source:   { axis: 'source',   axisLabel: t('applications.axes.source'),   segs: (data?.by_source ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    owner:    { axis: 'owner',    axisLabel: t('applications.axes.owner'),    segs: (data?.by_owner ?? []).map(s => ({ key: s.owner_id, label: s.name, count: s.count })) },
    customer: { axis: 'customer', axisLabel: t('applications.axes.customer'), segs: (data?.by_customer ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
  }
  // WHICH axes participate, and in what priority order, is the tenant's
  // Settings → Reports choice (bucket cards stay fixed — not in the axis
  // catalogue; "total" also stays pinned — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('applications').map(c => c.key)
  const defaultAxisOrder = getReportKpiDefaultOrder('applications')
  const storedAxisOrder = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('applications'), undefined)
  const { order: axisOrder, fellBack } = resolveReportKpiOrder(storedAxisOrder, catalogKeys, defaultAxisOrder)
  const axisConfigs: AxisKpiConfig[] = axisOrder.map(axis => allAxisConfigs[axis]).filter(Boolean)
  // A KPI card for an axis segment fills THAT axis's own list, exactly like
  // clicking the bar itself — never a shared overlay.
  const onAxisKpiPick = gateDrillClick('applications', (axis: string, key: string) => {
    const cfg = axisConfigs.find(c => c.axis === axis)
    const seg = cfg?.segs.find(s => s.key === key)
    if (seg) openSegment(axis as DrillKey, { label: seg.label, count: seg.count }, { [axis]: key })
  })
  const axisKpis = buildAxisKpis(axisConfigs, 4,
    (axis, key) => onAxisKpiPick?.(axis, key),
    (axis, key) => (drills[axis as DrillKey]?.rowsParams as Record<string, unknown> | undefined)?.[axis] === key)

  const kpis: KpiSpec[] = [
    { key: 'total', label: t('applications.total'), value: total },
    ...bucketKpis,
    ...axisKpis,
  ]

  return (
    <div>
      {/* KPI strip — total inflow, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('applications.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently — DD-MM-YYYY (never ISO, §3B). */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('applications.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
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
          </div>
        )}
      </div>
    </div>
  )
}
