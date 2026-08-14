/**
 * CandidatesReport — candidates/leads INFLOW report (GET /reports/candidates,
 * RAPPORTEN-SUITE-1). Danny's morning first-look: a created_at-windowed view of who
 * came in, broken down over the five axes (status · phase · source · owner · branch)
 * as calm hand-rolled bars (no Recharts, §3B) plus a week/day timeseries. The window
 * is rendered PROMINENTLY (from/to from the envelope) — this report is windowed on
 * created_at while the candidates LIST is not, so an invisible window reads as a bug
 * report ("counts don't match the list") instead of the deliberate report/list split.
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
import { useCandidatesReport } from './useCandidatesReport'
import { gateDrillClick } from './reportDrillGate'
import { buildAxisKpis } from './buildAxisKpis'
import type { AxisKpiConfig } from './buildAxisKpis'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateSegment, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'

// The five drillable axes; `param` is the XOR query key the drill/advice endpoints expect.
type Axis = 'status' | 'phase' | 'source' | 'owner' | 'branch'

export default function CandidatesReport({ period, tabsSlot, filters = EMPTY_REPORT_FILTERS }: { period: ReportPeriod; tabsSlot?: ReactNode; filters?: ReportFilterState }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useCandidatesReport(period, filters)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: any axis-segment bar or timeseries bucket explains itself (breakdown +
  // the candidates behind it + Koios advice). Exactly one XOR param per open drill —
  // ALWAYS layered on top of the report's own active filters (`baseParams`), never
  // just `period`, so the lade counts the exact same set the bar was drawn from.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const baseParams = buildReportQueryParams(period, 'candidates', filters)
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) => setDrill({
    title: seg.label, value: seg.count, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    rowsEndpoint: '/reports/candidates/drill', rowsParams: { ...baseParams, ...xorParam },
    adviceEndpoint: '/reports/candidates/advice', adviceParams: { ...baseParams, ...xorParam },
  })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/candidates/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/candidates/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  })

  const bars = (axis: Axis, segs: CandidateSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('candidates', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
  }

  const ownerBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('candidates', (value: string) => {
      const seg = segs.find(s => s.owner_id === value)
      if (seg) openSegment({ label: seg.name, count: seg.count }, { owner: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('candidates', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Nine-card KPI strip (Danny — same footprint as the dashboard): "total" plus
  // eight axis-derived cards, all real counts from the five axes already on the
  // response (§0 no fake affordances — nothing here is invented or hardcoded).
  const openParams = drill?.rowsParams as Record<string, unknown> | undefined
  const axisConfigs: AxisKpiConfig[] = [
    { axis: 'status', axisLabel: t('candidates.axes.status'), segs: (data?.by_status ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    { axis: 'phase',  axisLabel: t('candidates.axes.phase'),  segs: (data?.by_phase ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    { axis: 'source', axisLabel: t('candidates.axes.source'), segs: (data?.by_source ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    { axis: 'owner',  axisLabel: t('candidates.axes.owner'),  segs: (data?.by_owner ?? []).map(s => ({ key: s.owner_id, label: s.name, count: s.count })) },
    { axis: 'branch', axisLabel: t('candidates.axes.branch'), segs: (data?.by_branch ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
  ]
  const onAxisKpiPick = gateDrillClick('candidates', (axis: string, key: string) => {
    const cfg = axisConfigs.find(c => c.axis === axis)
    const seg = cfg?.segs.find(s => s.key === key)
    if (seg) openSegment({ label: seg.label, count: seg.count }, { [axis]: key })
  })
  const axisKpis = buildAxisKpis(axisConfigs, 8,
    (axis, key) => onAxisKpiPick?.(axis, key),
    (axis, key) => openParams?.[axis] === key)

  // "Total" is active when the open drill carries none of the axis/date keys —
  // `period`/`status`/`owner_id`/`location_id` are the report's own active FILTERS
  // (always present in baseParams, not the drill's XOR segment), so they must not
  // disqualify the total card the way an axis key does.
  const axisParamKeys = ['status', 'phase', 'source', 'owner', 'branch', 'date']
  const kpis: KpiSpec[] = [
    { key: 'total', label: t('candidates.total'), value: total,
      active: drill != null && (!openParams || axisParamKeys.every(k => openParams[k] === undefined)),
      onClick: gateDrillClick('candidates', () => openSegment({ label: t('candidates.total'), count: total }, {})) },
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

      {/* The report's data window, rendered prominently — DD-MM-YYYY (never ISO, §3B).
          A window that is invisible in the UI reads as a "report ≠ list" support ticket. */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('candidates.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && total === 0}
          loadingLabel={t('candidates.loading')} errorLabel={t('candidates.error')} emptyLabel={t('candidates.empty')}
          onRetry={() => refetch()}
        />
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Inflow over time — week/day timeseries, bucket set server-side. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.series')}</h3>
              <ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.status')}</h3>
              {bars('status', data.by_status)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.phase')}</h3>
              {bars('phase', data.by_phase)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.source')}</h3>
              {bars('source', data.by_source)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.owner')}</h3>
              {ownerBars(data.by_owner)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.branch')}</h3>
              {bars('branch', data.by_branch)}
            </section>
          </div>
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked segment/bucket + Koios AI advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
