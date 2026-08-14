/**
 * DepartmentsReport — customer-departments report (GET /reports/departments,
 * RAPPORTEN-SUITE-2). Mirrors TasksReport 1:1 (same envelope family, same calm
 * bars via the shared SegmentBars, window from the RESPONSE). Three-way XOR
 * drill: status|customer|location (+date, +bucket=week next to a week bar). No
 * dedicated summary block ships server-side — the KPI strip is derived ONLY
 * from `total` + the `by_location` axis totals (an honest count, never a
 * fabricated number).
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
import { useDepartmentsReport } from './useDepartmentsReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateSegment, ApplicationTopSegment, CandidateTimeseriesPoint } from '@/types/analytics'

type ColorAxis = 'status'
type PlainAxis = 'customer' | 'location'

export default function DepartmentsReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useDepartmentsReport(period)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: any axis-segment bar or timeseries bucket explains itself (the
  // departments behind it + Koios advice). Exactly one XOR param per open drill.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) => setDrill({
    title: seg.label, value: seg.count, subtitle: windowSub(),
    rowsEndpoint: '/reports/departments/drill', rowsParams: { ...xorParam, period },
    adviceEndpoint: '/reports/departments/advice', adviceParams: { ...xorParam, period },
  })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/departments/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/departments/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  })

  const colorBars = (axis: ColorAxis, segs: CandidateSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('departments', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
  }

  // Plain top-20 axes (customer/location) — no lookup colour.
  const plainBars = (axis: PlainAxis, segs: ApplicationTopSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('departments', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('departments', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // KPI strip: total + an honest linked/unlinked split off the `by_location`
  // axis's own 'none' bucket (real numbers, never invented ones).
  const withoutLocation = data?.by_location.find(s => s.value === 'none')?.count ?? 0
  const withLocation    = total - withoutLocation
  // The optional contact-coverage summary — only rendered when the endpoint
  // actually sends it (never fabricated when the block is absent).
  const summary = data?.summary
  const withoutCustomer = data?.by_customer.find(s => s.value === 'none')
  // Top real (non-'none') bar per axis — the biggest actual customer/location,
  // never a hardcoded value.
  const topCustomer = data?.by_customer.filter(s => s.value !== 'none').reduce<{ value: string; label: string; count: number } | null>(
    (top, s) => (!top || s.count > top.count) ? s : top, null)
  const topLocation = data?.by_location.filter(s => s.value !== 'none').reduce<{ value: string; label: string; count: number } | null>(
    (top, s) => (!top || s.count > top.count) ? s : top, null)
  // Distinct customers actually represented in this window's data — a real
  // count off the axis array, never a fabricated total.
  const customersCount = data?.by_customer.filter(s => s.value !== 'none' && s.value !== 'others').length ?? 0
  const kpis: KpiSpec[] = [
    { key: 'total',           label: t('departments.total'),            value: total },
    { key: 'withLocation',    label: t('departments.summary.withLocation'),    value: withLocation },
    { key: 'withoutLocation', label: t('departments.summary.withoutLocation'), value: withoutLocation },
    ...(summary ? [
      { key: 'withContacts',    label: t('departments.summary.withContacts'),    value: summary.with_contacts } as KpiSpec,
      { key: 'withoutContacts', label: t('departments.summary.withoutContacts'), value: summary.without_contacts } as KpiSpec,
    ] : []),
    { key: 'withoutCustomer', label: t('departments.summary.withoutCustomer'), value: withoutCustomer?.count ?? 0,
      onClick: withoutCustomer ? gateDrillClick('departments', () => openSegment(withoutCustomer, { customer: 'none' })) : undefined },
    ...(topCustomer ? [{ key: 'topCustomer', label: t('departments.summary.topCustomer'), value: topCustomer.count, sub: topCustomer.label,
      onClick: gateDrillClick('departments', () => openSegment(topCustomer, { customer: topCustomer.value })) } as KpiSpec] : []),
    ...(topLocation ? [{ key: 'topLocation', label: t('departments.summary.topLocation'), value: topLocation.count, sub: topLocation.label,
      onClick: gateDrillClick('departments', () => openSegment(topLocation, { location: topLocation.value })) } as KpiSpec] : []),
    { key: 'customersCount', label: t('departments.summary.customersCount'), value: customersCount },
  ]

  return (
    <div>
      {/* KPI strip — above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} />
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('departments.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && total === 0}
          loadingLabel={t('departments.loading')} errorLabel={t('departments.error')} emptyLabel={t('departments.empty')}
          onRetry={() => refetch()}
        />
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Created over time — week/day timeseries, bucket set server-side. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('departments.series')}</h3>
              <ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('departments.axes.status')}</h3>
              {colorBars('status', data.by_status.map(s => ({ ...s, color: s.color ?? null })))}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('departments.axes.customer')}</h3>
              {plainBars('customer', data.by_customer)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('departments.axes.location')}</h3>
              {plainBars('location', data.by_location)}
            </section>
          </div>
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked segment/bucket + Koios advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
