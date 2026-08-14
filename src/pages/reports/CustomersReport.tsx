/**
 * CustomersReport — customers INFLOW report (GET /reports/customers, RAPPORTEN-SUITE-1
 * "portie 3"). Mirrors CandidatesReport/ApplicationsReport 1:1 (same envelope family,
 * same calm hand-rolled bars via the shared SegmentBars, no Recharts §3B): the window
 * is rendered PROMINENTLY since this report is windowed on customers.created_at while
 * the customers LIST is not. Leads live on `by_phase` (flag-driven is_customer, NOT a
 * 'prospect' status string — PROSPECT-DEDUP-1 retired that) — never assume a status
 * value means "lead". There is deliberately no by_source axis: customers carry no
 * `source` column, so it is never invented here.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { DrillSpec } from './ReportDrillDrawer'
import { useCustomersReport } from './useCustomersReport'
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

// The four plain axes; `param` is the XOR query key the drill/advice endpoints expect.
// Deliberately no 'source' — see the header comment.
type Axis = 'status' | 'phase' | 'industry' | 'branch'

// Every drillable section on this page, each owning its OWN always-visible list
// (ReportChartWithDrillList) — one key per section, never a single global `drill`.
type DrillKey = Axis | 'owner' | 'series'

export default function CustomersReport({ period, filters = EMPTY_REPORT_FILTERS }: { period: ReportPeriod; filters?: ReportFilterState }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useCustomersReport(period, filters)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: every axis section and the timeseries own an ALWAYS-VISIBLE list
  // beside their chart (ReportChartWithDrillList) instead of a shared overlay — so
  // one key per section, never a single global `drill`. Exactly one XOR param per
  // open drill — ALWAYS layered on top of the report's own active filters
  // (`baseParams`), never just `period`, so the list counts the exact same set the
  // bar was drawn from.
  const [drills, setDrills] = useState<Partial<Record<DrillKey, DrillSpec>>>({})
  const baseParams = buildReportQueryParams(period, 'customers', filters)
  const openSegment = (key: DrillKey, seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrills(d => ({ ...d, [key]: {
      title: seg.label, value: seg.count, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
      rowsEndpoint: '/reports/customers/drill', rowsParams: { ...baseParams, ...xorParam },
      adviceEndpoint: '/reports/customers/advice', adviceParams: { ...baseParams, ...xorParam },
    } }))
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrills(d => ({ ...d, series: {
    title: pt.label, value: pt.value, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    // A week bar's `date` is the point's own key; the list then counts the WHOLE
    // week (bucket=week) so bar and list total always agree.
    rowsEndpoint: '/reports/customers/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/customers/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  } }))

  // Generic axis-bar renderer: a segment whose lookup row was deleted still arrives
  // here as a normal array entry (its own "Onbekend (…)" label, summed into total) —
  // no special-casing needed, it drills on the raw value like any other segment.
  const bars = (axis: Axis, segs: CandidateSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('customers', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(axis, seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
  }

  const ownerBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('customers', (value: string) => {
      const seg = segs.find(s => s.owner_id === value)
      if (seg) openSegment('owner', { label: seg.name, count: seg.count }, { owner: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('customers', (dateKey: string) => {
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
    const topIndustry = top(data.by_industry, s => s.count)
    const topOwner = top(data.by_owner, s => s.count)
    const topBranch = top(data.by_branch, s => s.count)
    if (topStatus) openSegment('status', topStatus, { status: topStatus.value })
    if (topPhase) openSegment('phase', topPhase, { phase: topPhase.value })
    if (topIndustry) openSegment('industry', topIndustry, { industry: topIndustry.value })
    if (topOwner) openSegment('owner', { label: topOwner.name, count: topOwner.count }, { owner: topOwner.owner_id })
    if (topBranch) openSegment('branch', topBranch, { branch: topBranch.value })
    if (data.timeseries.series.length) openBucket(data.timeseries.series[data.timeseries.series.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.from, data?.to])

  // Nine-card KPI strip (same footprint as the dashboard): "total" plus eight
  // axis-derived cards, all real counts from the five axes already on the
  // response (§0 no fake affordances — nothing here is invented or hardcoded;
  // deliberately no by_source axis here, see the header comment).
  const allAxisConfigs: Record<Axis | 'owner', AxisKpiConfig> = {
    status:   { axis: 'status',   axisLabel: t('customers.axes.status'),   segs: (data?.by_status ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    phase:    { axis: 'phase',    axisLabel: t('customers.axes.phase'),    segs: (data?.by_phase ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    industry: { axis: 'industry', axisLabel: t('customers.axes.industry'), segs: (data?.by_industry ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    owner:    { axis: 'owner',    axisLabel: t('customers.axes.owner'),    segs: (data?.by_owner ?? []).map(s => ({ key: s.owner_id, label: s.name, count: s.count })) },
    branch:   { axis: 'branch',   axisLabel: t('customers.axes.branch'),   segs: (data?.by_branch ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
  }
  // WHICH axes participate, and in what priority order, is the tenant's
  // Settings → Reports choice ("total" stays pinned — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('customers').map(c => c.key)
  const defaultAxisOrder = getReportKpiDefaultOrder('customers')
  const storedAxisOrder = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('customers'), undefined)
  const { order: axisOrder, fellBack } = resolveReportKpiOrder(storedAxisOrder, catalogKeys, defaultAxisOrder)
  const axisConfigs: AxisKpiConfig[] = axisOrder.map(axis => allAxisConfigs[axis as Axis | 'owner']).filter(Boolean)
  // A KPI card for an axis segment fills THAT axis's own list, exactly like
  // clicking the bar itself — never a shared overlay.
  const onAxisKpiPick = gateDrillClick('customers', (axis: string, key: string) => {
    const cfg = axisConfigs.find(c => c.axis === axis)
    const seg = cfg?.segs.find(s => s.key === key)
    if (seg) openSegment(axis as DrillKey, { label: seg.label, count: seg.count }, { [axis]: key })
  })
  const axisKpis = buildAxisKpis(axisConfigs, 8,
    (axis, key) => onAxisKpiPick?.(axis, key),
    (axis, key) => (drills[axis as DrillKey]?.rowsParams as Record<string, unknown> | undefined)?.[axis] === key)

  // "Total" seeds every axis's list back to its own top segment (mirrors the
  // mount default) — there is no single "total" drill anymore, each section
  // keeps its own state.
  const kpis: KpiSpec[] = [
    { key: 'total', label: t('customers.total'), value: total },
    ...axisKpis,
  ]

  return (
    <div>
      {/* KPI strip — total inflow, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('customers.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently — DD-MM-YYYY (never ISO, §3B). */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('customers.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && total === 0}
          loadingLabel={t('customers.loading')} errorLabel={t('customers.error')} emptyLabel={t('customers.empty')}
          onRetry={() => refetch()}
        />
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Inflow over time — week/day timeseries, bucket set server-side. Its own
                always-visible list sits beside it, never a shared overlay. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.series')}</h3>
              <ReportChartWithDrillList drill={drills.series ?? null} placeholderLabel={t('customers.series')}
                chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.status')}</h3>
              <ReportChartWithDrillList drill={drills.status ?? null} placeholderLabel={t('customers.axes.status')}
                chart={bars('status', data.by_status)} />
            </section>

            {/* Leads surface HERE, not on a status value (PROSPECT-DEDUP-1 retired
                the old 'prospect' status) — flag-driven, same principle as the
                dashboard leads KPI. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.phase')}</h3>
              <ReportChartWithDrillList drill={drills.phase ?? null} placeholderLabel={t('customers.axes.phase')}
                chart={bars('phase', data.by_phase)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.industry')}</h3>
              <ReportChartWithDrillList drill={drills.industry ?? null} placeholderLabel={t('customers.axes.industry')}
                chart={bars('industry', data.by_industry)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.owner')}</h3>
              <ReportChartWithDrillList drill={drills.owner ?? null} placeholderLabel={t('customers.axes.owner')}
                chart={ownerBars(data.by_owner)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.branch')}</h3>
              <ReportChartWithDrillList drill={drills.branch ?? null} placeholderLabel={t('customers.axes.branch')}
                chart={bars('branch', data.by_branch)} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
