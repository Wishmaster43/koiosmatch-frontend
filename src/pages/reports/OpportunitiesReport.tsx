/**
 * OpportunitiesReport — opportunities (kansen) pipeline report (GET
 * /reports/opportunities, RAPPORTEN-SUITE-1 "portie 5"). Mirrors CustomersReport /
 * VacanciesReport 1:1: same envelope family, same calm hand-rolled bars via the
 * shared SegmentBars, the window rendered prominently. Drill XOR params follow the
 * five-way opportunities contract: stage|customer|owner|branch|date (+bucket=week
 * next to a week bar's date). Every axis sums to `total`; 'none'/'others' sentinels
 * and orphan-uuid rows (deleted stage / hard-deleted customer) are normal, drillable
 * bars. Forecast/stale from the envelope are deliberately not rendered yet (own
 * design round) — nothing hidden is interactive, so no fake affordances.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useOpportunitiesReport } from './useOpportunitiesReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat, formatPercent } from '@/lib/formatters'
import type { ReportPeriod, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'

// The three plain single-value XOR axes; `owner` has its own D2 shape below.
type Axis = 'stage' | 'customer' | 'branch'

// Minimal surface the generic bar renderer needs — stage rows carry a lookup
// colour, customer/branch rows do not (SegmentBars falls back to the primary tint).
type AxisSeg = { value: string; label: string; count: number; color?: string | null }

export default function OpportunitiesReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { formatCurrency } = useNumberFormat()
  const { data, loading, error, refetch } = useOpportunitiesReport(period)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: any axis-segment bar or timeseries bucket explains itself (the
  // opportunities behind it + Koios advice). Exactly one XOR param per open drill.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.period.from)} – ${formatDate(data?.period.to)}`
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) => setDrill({
    title: seg.label, value: seg.count, subtitle: windowSub(),
    rowsEndpoint: '/reports/opportunities/drill', rowsParams: { ...xorParam, period },
    adviceEndpoint: '/reports/opportunities/advice', adviceParams: { ...xorParam, period },
  })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/opportunities/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/opportunities/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  })

  // Generic axis-bar renderer: 'none'/'others' sentinels and orphaned (deleted-
  // lookup) values are all normal array entries — each drills on its RAW value,
  // exactly like any other segment (no special-casing, see SegmentBars).
  const bars = (axis: Axis, segs: AxisSeg[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('opportunities', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color ?? null }))} />
  }

  // Owner axis (D2 shape: owner_id/name → the `owner` param).
  const ownerBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('opportunities', (value: string) => {
      const seg = segs.find(s => s.owner_id === value)
      if (seg) openSegment({ label: seg.name, count: seg.count }, { owner: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('opportunities', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Pipeline-health KPI strip from the envelope's totals. Not drillable: the
  // five-way XOR carries no open/won/lost segment (no fake affordances). win_rate
  // is null until a deal is decided — placeholder, never a fabricated 0%.
  // Nine-card footprint (Danny — same as the dashboard). The pipeline five stay
  // as-is; the stale-deal counters and the forecast totals are real sums over
  // fields the endpoint already returns (`stale` and `forecast[]`) — neither is
  // a drillable XOR axis today, so both render as plain, honest, non-clickable
  // stats rather than a dead button (no fake affordances).
  const s = data?.totals
  const forecastCount = data?.forecast.reduce((sum, row) => sum + row.count, 0) ?? 0
  const forecastValue = data?.forecast.reduce((sum, row) => sum + row.value_sum, 0) ?? 0
  const kpis: KpiSpec[] = [
    { key: 'total',   label: t('opportunities.total'),           value: total },
    { key: 'open',    label: t('opportunities.summary.open'),    value: s?.open ?? 0 },
    { key: 'won',     label: t('opportunities.summary.won'),     value: s?.won ?? 0 },
    { key: 'lost',    label: t('opportunities.summary.lost'),    value: s?.lost ?? 0 },
    { key: 'winRate', label: t('opportunities.summary.winRate'),
      value: formatPercent(s?.win_rate) },
    { key: 'untouched', label: t('opportunities.stale.untouched'), value: data?.stale.untouched ?? 0 },
    { key: 'overdue',   label: t('opportunities.stale.overdue'),   value: data?.stale.overdue ?? 0 },
    { key: 'forecastCount', label: t('opportunities.forecastCount'), value: forecastCount },
    { key: 'forecastValue', label: t('opportunities.forecastValue'), value: formatCurrency(forecastValue, 'EUR', 0) },
  ]

  return (
    <div>
      {/* KPI strip — pipeline health, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} />
      )}

      {/* The report's data window, rendered prominently — DD-MM-YYYY (never ISO, §3B). */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('opportunities.window', { from: formatDate(data.period.from), to: formatDate(data.period.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && total === 0}
          loadingLabel={t('opportunities.loading')} errorLabel={t('opportunities.error')} emptyLabel={t('opportunities.empty')}
          onRetry={() => refetch()}
        />
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Created over time — week/day timeseries, bucket set server-side. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('opportunities.series')}</h3>
              <ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />
            </section>

            {/* Stage axis — always sums to total ('none' + orphan-uuid rows included). */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.stage')}</h3>
              {bars('stage', data.by_stage)}
            </section>

            {/* Top-20 customers + 'others' + 'none'; a hard-deleted customer's
                "Onbekend" bar still drills on its raw uuid. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.customer')}</h3>
              {bars('customer', data.by_customer)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.owner')}</h3>
              {ownerBars(data.by_owner)}
            </section>

            {/* Branch axis on the deal's OWN location_id column (unlike vacancies,
                no customer detour) — drills via the report `branch` param. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.branch')}</h3>
              {bars('branch', data.by_branch)}
            </section>
          </div>
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked segment/bucket + Koios advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
