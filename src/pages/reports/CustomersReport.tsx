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
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useCustomersReport } from './useCustomersReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateSegment, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'

const card:  CSSProperties = { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }
const state: CSSProperties = { textAlign: 'center', padding: 40, fontSize: 13 }
const head:  CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.04em', color: 'var(--text-muted)', margin: 0 }

// The four plain axes; `param` is the XOR query key the drill/advice endpoints expect.
// Deliberately no 'source' — see the header comment.
type Axis = 'status' | 'phase' | 'industry' | 'branch'

export default function CustomersReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error } = useCustomersReport(period)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: any axis-segment bar or timeseries bucket explains itself (breakdown +
  // the customers behind it + Koios advice). Exactly one XOR param per open drill.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) => setDrill({
    title: seg.label, value: seg.count, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    rowsEndpoint: '/reports/customers/drill', rowsParams: { ...xorParam, period },
    adviceEndpoint: '/reports/customers/advice', adviceParams: { ...xorParam, period },
  })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/customers/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/customers/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  })

  // Generic axis-bar renderer: a segment whose lookup row was deleted still arrives
  // here as a normal array entry (its own "Onbekend (…)" label, summed into total) —
  // no special-casing needed, it drills on the raw value like any other segment.
  const bars = (axis: Axis, segs: CandidateSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('customers', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
  }

  const ownerBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('customers', (value: string) => {
      const seg = segs.find(s => s.owner_id === value)
      if (seg) openSegment({ label: seg.name, count: seg.count }, { owner: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('customers', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  const kpis: KpiSpec[] = [{ key: 'total', label: t('customers.total'), value: total }]

  return (
    <div>
      {/* KPI strip — total inflow, above the tabs (candidate-page order) */}
      {hasData && (
        <div style={{ ...card, marginBottom: 16 }}>
          <InsightsRow kpis={kpis} padding="14px 20px" />
        </div>
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

      {/* The report's data window, rendered prominently — DD-MM-YYYY (never ISO, §3B). */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('customers.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('customers.loading')}</div>}
        {error && !loading && <div style={{ ...state, color: 'var(--color-danger)' }}>{t('customers.error')}</div>}
        {!loading && !error && total === 0 && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('customers.empty')}</div>}
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Inflow over time — week/day timeseries, bucket set server-side. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.series')}</h3>
              <ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.status')}</h3>
              {bars('status', data.by_status)}
            </section>

            {/* Leads surface HERE, not on a status value (PROSPECT-DEDUP-1 retired
                the old 'prospect' status) — flag-driven, same principle as the
                dashboard leads KPI. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.phase')}</h3>
              {bars('phase', data.by_phase)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.industry')}</h3>
              {bars('industry', data.by_industry)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.owner')}</h3>
              {ownerBars(data.by_owner)}
            </section>

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
