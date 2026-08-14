/**
 * CandidatesReport — candidates/leads INFLOW report (GET /reports/candidates,
 * RAPPORTEN-SUITE-1). Danny's morning first-look: a created_at-windowed view of who
 * came in, broken down over the five axes (status · phase · source · owner · branch)
 * as calm hand-rolled bars (no Recharts, §3B) plus a week/day timeseries. The window
 * is rendered PROMINENTLY (from/to from the envelope) — this report is windowed on
 * created_at while the candidates LIST is not, so an invisible window reads as a bug
 * report ("counts don't match the list") instead of the deliberate report/list split.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { DrillSpec } from './ReportDrillDrawer'
import { useCandidatesReport } from './useCandidatesReport'
import { gateDrillClick } from './reportDrillGate'
import { buildAxisKpis } from './buildAxisKpis'
import type { AxisKpiConfig } from './buildAxisKpis'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import SegmentBars from './SegmentBars'
import ReportChartWithDrillList from './ReportChartWithDrillList'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateSegment, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

// The five drillable axes; `param` is the XOR query key the drill/advice endpoints expect.
type Axis = 'status' | 'phase' | 'source' | 'owner' | 'branch'

export default function CandidatesReport({ period, filters = EMPTY_REPORT_FILTERS }: { period: ReportPeriod; filters?: ReportFilterState }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useCandidatesReport(period, filters)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: every axis section and the timeseries own an ALWAYS-VISIBLE list
  // beside their chart (ReportChartWithDrillList) instead of a shared overlay — so
  // one key per section, never a single global `drill`. Exactly one XOR param per
  // open drill — ALWAYS layered on top of the report's own active filters
  // (`baseParams`), never just `period`, so the list counts the exact same set the
  // bar was drawn from.
  type DrillKey = Axis | 'series'
  const [drills, setDrills] = useState<Partial<Record<DrillKey, DrillSpec>>>({})
  const baseParams = buildReportQueryParams(period, 'candidates', filters)
  const openSegment = (key: DrillKey, seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrills(d => ({ ...d, [key]: {
      title: seg.label, value: seg.count, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
      rowsEndpoint: '/reports/candidates/drill', rowsParams: { ...baseParams, ...xorParam },
      adviceEndpoint: '/reports/candidates/advice', adviceParams: { ...baseParams, ...xorParam },
    } }))
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrills(d => ({ ...d, series: {
    title: pt.label, value: pt.value, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    // A week bar's `date` is the point's own key; the list then counts the WHOLE
    // week (bucket=week) so bar and list total always agree.
    rowsEndpoint: '/reports/candidates/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/candidates/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  } }))

  const bars = (axis: Axis, segs: CandidateSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('candidates', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(axis, seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
  }

  const ownerBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('candidates', (value: string) => {
      const seg = segs.find(s => s.owner_id === value)
      if (seg) openSegment('owner', { label: seg.name, count: seg.count }, { owner: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('candidates', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Default each section's list to its own top segment on mount so no panel is
  // ever blank — mirrors clicking that segment's own bar, never a client-side guess.
  useEffect(() => {
    if (!data) return
    const top = <T,>(segs: T[], count: (s: T) => number) => segs.length ? segs.reduce((a, b) => (count(b) > count(a) ? b : a)) : null
    const topStatus = top(data.by_status, s => s.count)
    const topPhase = top(data.by_phase, s => s.count)
    const topSource = top(data.by_source, s => s.count)
    const topOwner = top(data.by_owner, s => s.count)
    const topBranch = top(data.by_branch, s => s.count)
    if (topStatus) openSegment('status', topStatus, { status: topStatus.value })
    if (topPhase) openSegment('phase', topPhase, { phase: topPhase.value })
    if (topSource) openSegment('source', topSource, { source: topSource.value })
    if (topOwner) openSegment('owner', { label: topOwner.name, count: topOwner.count }, { owner: topOwner.owner_id })
    if (topBranch) openSegment('branch', topBranch, { branch: topBranch.value })
    if (data.timeseries.series.length) openBucket(data.timeseries.series[data.timeseries.series.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.from, data?.to])

  // Nine-card KPI strip (Danny — same footprint as the dashboard): "total" plus
  // eight axis-derived cards, all real counts from the five axes already on the
  // response (§0 no fake affordances — nothing here is invented or hardcoded).
  // WHICH axes participate, and in what priority order, is the tenant's
  // Settings → Reports choice ("total" itself stays pinned — RAPPORT-KPI-INSTELBAAR).
  const allAxisConfigs: Record<Axis, AxisKpiConfig> = {
    status: { axis: 'status', axisLabel: t('candidates.axes.status'), segs: (data?.by_status ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    phase:  { axis: 'phase',  axisLabel: t('candidates.axes.phase'),  segs: (data?.by_phase ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    source: { axis: 'source', axisLabel: t('candidates.axes.source'), segs: (data?.by_source ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    owner:  { axis: 'owner',  axisLabel: t('candidates.axes.owner'),  segs: (data?.by_owner ?? []).map(s => ({ key: s.owner_id, label: s.name, count: s.count })) },
    branch: { axis: 'branch', axisLabel: t('candidates.axes.branch'), segs: (data?.by_branch ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
  }
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('candidates').map(c => c.key)
  const defaultAxisOrder = getReportKpiDefaultOrder('candidates')
  const storedAxisOrder = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('candidates'), undefined)
  const { order: axisOrder, fellBack } = resolveReportKpiOrder(storedAxisOrder, catalogKeys, defaultAxisOrder)
  const axisConfigs: AxisKpiConfig[] = axisOrder.map(axis => allAxisConfigs[axis as Axis]).filter(Boolean)
  // A KPI card for an axis segment fills THAT axis's own list, exactly like
  // clicking the bar itself — never a shared overlay.
  const onAxisKpiPick = gateDrillClick('candidates', (axis: string, key: string) => {
    const cfg = axisConfigs.find(c => c.axis === axis)
    const seg = cfg?.segs.find(s => s.key === key)
    if (seg) openSegment(axis as Axis, { label: seg.label, count: seg.count }, { [axis]: key })
  })
  const axisKpis = buildAxisKpis(axisConfigs, 8,
    (axis, key) => onAxisKpiPick?.(axis, key),
    (axis, key) => (drills[axis as Axis]?.rowsParams as Record<string, unknown> | undefined)?.[axis] === key)

  // "Total" seeds every axis's list back to its own top segment (mirrors the
  // mount default) — there is no single "total" drill anymore, each section
  // keeps its own state.
  const kpis: KpiSpec[] = [
    { key: 'total', label: t('candidates.total'), value: total },
    ...axisKpis,
  ]

  return (
    <div>
      {/* KPI strip — total inflow, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('candidates.kpiOrderFellBack') : undefined} />
      )}

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
            {/* Inflow over time — week/day timeseries, bucket set server-side. Its own
                always-visible list sits beside it, never a shared overlay. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.series')}</h3>
              <ReportChartWithDrillList drill={drills.series ?? null} placeholderLabel={t('candidates.series')}
                chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.status')}</h3>
              <ReportChartWithDrillList drill={drills.status ?? null} placeholderLabel={t('candidates.axes.status')}
                chart={bars('status', data.by_status)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.phase')}</h3>
              <ReportChartWithDrillList drill={drills.phase ?? null} placeholderLabel={t('candidates.axes.phase')}
                chart={bars('phase', data.by_phase)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.source')}</h3>
              <ReportChartWithDrillList drill={drills.source ?? null} placeholderLabel={t('candidates.axes.source')}
                chart={bars('source', data.by_source)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.owner')}</h3>
              <ReportChartWithDrillList drill={drills.owner ?? null} placeholderLabel={t('candidates.axes.owner')}
                chart={ownerBars(data.by_owner)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.branch')}</h3>
              <ReportChartWithDrillList drill={drills.branch ?? null} placeholderLabel={t('candidates.axes.branch')}
                chart={bars('branch', data.by_branch)} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
