/**
 * ApplicationsReport — applications INFLOW report (GET /reports/applications,
 * RAPPORTEN-SUITE-1 "portie 2"). Mirrors CandidatesReport 1:1 (same envelope
 * family, same calm hand-rolled bars, no Recharts §3B): the window is rendered
 * PROMINENTLY (from/to from the envelope) since this report is windowed on
 * applications.created_at while the applications LIST is not — an invisible
 * window reads as "counts don't match the list" instead of the deliberate split.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useApplicationsReport } from './useApplicationsReport'
import { gateDrillClick } from './reportDrillGate'
import { buildAxisKpis } from './buildAxisKpis'
import type { AxisKpiConfig } from './buildAxisKpis'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type {
  ReportPeriod, CandidateSegment, CandidateOwnerSegment, CandidateTimeseriesPoint,
  ApplicationTopSegment, ApplicationBucketCounts,
} from '@/types/analytics'

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

export default function ApplicationsReport({ period, tabsSlot, filters = EMPTY_REPORT_FILTERS }: { period: ReportPeriod; tabsSlot?: ReactNode; filters?: ReportFilterState }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useApplicationsReport(period, filters)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: any axis-segment bar or timeseries bucket explains itself (breakdown +
  // the applications behind it + Koios advice). Exactly one XOR param per open drill —
  // ALWAYS layered on top of the report's own active filters (`baseParams`), never
  // just `period`, so the lade counts the exact same set the bar was drawn from.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const baseParams = buildReportQueryParams(period, 'applications', filters)
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) => setDrill({
    title: seg.label, value: seg.count, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    rowsEndpoint: '/reports/applications/drill', rowsParams: { ...baseParams, ...xorParam },
    adviceEndpoint: '/reports/applications/advice', adviceParams: { ...baseParams, ...xorParam },
  })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    // DUAL ROLE of the `bucket` param (contract note, "portie 2"): here it is the
    // GRANULARITY companion of `date` (day|week — a week bar counts the whole week,
    // so bar and drawer totals always agree). Below, in bucketBars(), `bucket` is
    // instead a FUNNEL segment value (active|matched|rejected|placed) sent WITHOUT
    // `date`. The two value sets never overlap, so the two roles never collide.
    rowsEndpoint: '/reports/applications/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/applications/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  })

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

  const onSeriesPick = gateDrillClick('applications', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Nine-card KPI strip (same footprint as the dashboard): total + the four fixed
  // funnel-bucket counts (real, flag-driven, already on the response) + the top
  // segment of four more axes (stage/source/owner/customer) — all real counts,
  // nothing invented (§0 no fake affordances). `vacancy` stays out of the strip
  // (top-20+others is a weak "top KPI" pick) but is still fully shown as bars below.
  const openParams = drill?.rowsParams as Record<string, unknown> | undefined
  const bucketKpis: KpiSpec[] = BUCKET_KEYS.map(k => ({
    key: `bucket:${k}`, label: `${t('applications.axes.bucket')}: ${t(`applications.buckets.${k}`)}`, value: data?.by_bucket[k] ?? 0,
    active: openParams?.bucket === k,
    onClick: gateDrillClick('applications', () => openSegment({ label: t(`applications.buckets.${k}`), count: data?.by_bucket[k] ?? 0 }, { bucket: k })),
  }))
  const axisConfigs: AxisKpiConfig[] = [
    { axis: 'stage',    axisLabel: t('applications.axes.stage'),    segs: (data?.by_stage ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    { axis: 'source',   axisLabel: t('applications.axes.source'),   segs: (data?.by_source ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    { axis: 'owner',    axisLabel: t('applications.axes.owner'),    segs: (data?.by_owner ?? []).map(s => ({ key: s.owner_id, label: s.name, count: s.count })) },
    { axis: 'customer', axisLabel: t('applications.axes.customer'), segs: (data?.by_customer ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
  ]
  const onAxisKpiPick = gateDrillClick('applications', (axis: string, key: string) => {
    const cfg = axisConfigs.find(c => c.axis === axis)
    const seg = cfg?.segs.find(s => s.key === key)
    if (seg) openSegment({ label: seg.label, count: seg.count }, { [axis]: key })
  })
  const axisKpis = buildAxisKpis(axisConfigs, 4,
    (axis, key) => onAxisKpiPick?.(axis, key),
    (axis, key) => openParams?.[axis] === key)

  const kpis: KpiSpec[] = [
    { key: 'total', label: t('applications.total'), value: total,
      active: drill != null && (!openParams || Object.keys(openParams).every(k => k === 'period')),
      onClick: gateDrillClick('applications', () => openSegment({ label: t('applications.total'), count: total }, {})) },
    ...bucketKpis,
    ...axisKpis,
  ]

  return (
    <div>
      {/* KPI strip — total inflow, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} />
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

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
            {/* Inflow over time — week/day timeseries, bucket set server-side. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.series')}</h3>
              <ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.bucket')}</h3>
              {bucketBars(data.by_bucket)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.stage')}</h3>
              {bars('stage', data.by_stage)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.source')}</h3>
              {bars('source', data.by_source)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.owner')}</h3>
              {ownerBars(data.by_owner)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.customer')}</h3>
              {bars('customer', data.by_customer)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.vacancy')}</h3>
              {bars('vacancy', data.by_vacancy)}
            </section>
          </div>
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked segment/bucket + Koios AI advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
