/**
 * LocationsReport — customer-locations report (GET /reports/locations,
 * RAPPORTEN-SUITE-2). Mirrors TasksReport 1:1 (same envelope family, same calm
 * bars via the shared SegmentBars, window from the RESPONSE). Four-way XOR
 * drill: status|customer|city|province (+date, +bucket=week next to a week
 * bar). No dedicated summary block ships server-side — the KPI strip is derived
 * ONLY from `total` + the `by_customer` axis totals (an honest count, never a
 * fabricated number).
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useLocationsReport } from './useLocationsReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateSegment, ApplicationTopSegment, CandidateTimeseriesPoint } from '@/types/analytics'

const card:  CSSProperties = { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }
const state: CSSProperties = { textAlign: 'center', padding: 40, fontSize: 13 }
const head:  CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.04em', color: 'var(--text-muted)', margin: 0 }

type ColorAxis = 'status'
type PlainAxis = 'customer' | 'city' | 'province'

export default function LocationsReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error } = useLocationsReport(period)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: any axis-segment bar or timeseries bucket explains itself (the
  // locations behind it + Koios advice). Exactly one XOR param per open drill.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) => setDrill({
    title: seg.label, value: seg.count, subtitle: windowSub(),
    rowsEndpoint: '/reports/locations/drill', rowsParams: { ...xorParam, period },
    adviceEndpoint: '/reports/locations/advice', adviceParams: { ...xorParam, period },
  })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/locations/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/locations/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  })

  const colorBars = (axis: ColorAxis, segs: CandidateSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('locations', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
  }

  // Plain top-20 axes (customer/city/province) — no lookup colour.
  const plainBars = (axis: PlainAxis, segs: ApplicationTopSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('locations', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))} />
  }

  const seriesMax = (data?.timeseries.series ?? []).reduce((m, p) => Math.max(m, p.value), 0)
  const onSeriesPick = gateDrillClick('locations', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // KPI strip: total + an honest linked/unlinked split off the `by_customer`
  // axis's own 'none' bucket (real numbers, never invented ones).
  const withoutCustomer = data?.by_customer.find(s => s.value === 'none')?.count ?? 0
  const withCustomer    = total - withoutCustomer
  const kpis: KpiSpec[] = [
    { key: 'total',            label: t('locations.total'),            value: total },
    { key: 'withCustomer',     label: t('locations.summary.withCustomer'),    value: withCustomer },
    { key: 'withoutCustomer',  label: t('locations.summary.withoutCustomer'), value: withoutCustomer },
  ]

  return (
    <div>
      {/* KPI strip — above the tabs (candidate-page order) */}
      {hasData && (
        <div style={{ ...card, marginBottom: 16 }}>
          <InsightsRow kpis={kpis} padding="14px 20px" />
        </div>
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('locations.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('locations.loading')}</div>}
        {error && !loading && <div style={{ ...state, color: 'var(--color-danger)' }}>{t('locations.error')}</div>}
        {!loading && !error && total === 0 && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('locations.empty')}</div>}
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Created over time — week/day timeseries, bucket set server-side. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('locations.series')}</h3>
              <SegmentBars max={seriesMax} onPick={onSeriesPick}
                items={data.timeseries.series.map(p => ({ key: p.date, label: p.label, count: p.value, color: null }))} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('locations.axes.status')}</h3>
              {colorBars('status', data.by_status.map(s => ({ ...s, color: s.color ?? null })))}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('locations.axes.customer')}</h3>
              {plainBars('customer', data.by_customer)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('locations.axes.city')}</h3>
              {plainBars('city', data.by_city)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('locations.axes.province')}</h3>
              {plainBars('province', data.by_province)}
            </section>
          </div>
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked segment/bucket + Koios advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
