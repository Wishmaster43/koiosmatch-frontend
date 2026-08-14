/**
 * DepartmentsReport — customer-departments report (GET /reports/departments,
 * RAPPORTEN-SUITE-2). Mirrors CandidatesReport's drill-list pattern (
 * RAPPORTEN-DRILLLIST-1): every axis section and the timeseries own an
 * ALWAYS-VISIBLE list beside their chart (ReportChartWithDrillList), seeded
 * with that section's own top segment on mount, never a shared overlay.
 * Three-way XOR drill: status|customer|location (+date, +bucket=week next
 * to a week bar). No dedicated summary block ships server-side — the KPI
 * strip is derived ONLY from `total` + the `by_location` axis totals (an
 * honest count, never a fabricated number).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { DrillSpec } from './ReportDrillDrawer'
import { useDepartmentsReport } from './useDepartmentsReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportChartWithDrillList from './ReportChartWithDrillList'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateSegment, ApplicationTopSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

type ColorAxis = 'status'
type PlainAxis = 'customer' | 'location'
type DrillKey = ColorAxis | PlainAxis | 'series'

export default function DepartmentsReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useDepartmentsReport(period)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: every axis section and the timeseries own an ALWAYS-VISIBLE list
  // beside their chart — one key per section, never a single global `drill`, so
  // clicking a segment in one chart never changes another chart's list.
  const [drills, setDrills] = useState<Partial<Record<DrillKey, DrillSpec>>>({})
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openSegment = (key: DrillKey, seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrills(d => ({ ...d, [key]: {
      title: seg.label, value: seg.count, subtitle: windowSub(),
      rowsEndpoint: '/reports/departments/drill', rowsParams: { ...xorParam, period },
      adviceEndpoint: '/reports/departments/advice', adviceParams: { ...xorParam, period },
    } }))
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrills(d => ({ ...d, series: {
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the list then counts the WHOLE
    // week (bucket=week) so bar and list total always agree.
    rowsEndpoint: '/reports/departments/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/departments/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  } }))

  const colorBars = (axis: ColorAxis, segs: CandidateSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('departments', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(axis, seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
  }

  // Plain top-20 axes (customer/location) — no lookup colour.
  const plainBars = (axis: PlainAxis, segs: ApplicationTopSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('departments', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(axis, seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('departments', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Default each section's list to its own top segment on mount so no panel is
  // ever blank — mirrors clicking that segment's own bar, never a client-side guess.
  useEffect(() => {
    if (!data) return
    const top = <T,>(segs: T[], count: (s: T) => number) => segs.length ? segs.reduce((a, b) => (count(b) > count(a) ? b : a)) : null
    const topStatus   = top(data.by_status, s => s.count)
    const topCustomer = top(data.by_customer, s => s.count)
    const topLocation = top(data.by_location, s => s.count)
    if (topStatus)   openSegment('status', topStatus, { status: topStatus.value })
    if (topCustomer) openSegment('customer', topCustomer, { customer: topCustomer.value })
    if (topLocation) openSegment('location', topLocation, { location: topLocation.value })
    if (data.timeseries.series.length) openBucket(data.timeseries.series[data.timeseries.series.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.from, data?.to])

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
  // Exactly nine cards, always (Danny — the strip's footprint never reflows
  // between pages). `topCustomer`/`topLocation` and the contact-coverage
  // summary are PERMANENT slots: while their underlying value is absent, the
  // card still renders (house dash, never a fabricated 0 or a missing slot)
  // and reclaims its normal number the moment the data exists.
  const kpiByKey: Record<string, KpiSpec> = {
    total:           { key: 'total',           label: t('departments.total'),            value: total },
    withLocation:    { key: 'withLocation',    label: t('departments.summary.withLocation'),    value: withLocation },
    withoutLocation: { key: 'withoutLocation', label: t('departments.summary.withoutLocation'), value: withoutLocation },
    withoutCustomer: { key: 'withoutCustomer', label: t('departments.summary.withoutCustomer'), value: withoutCustomer?.count ?? 0,
      onClick: withoutCustomer ? gateDrillClick('departments', () => openSegment('customer', withoutCustomer, { customer: 'none' })) : undefined },
    topCustomer: { key: 'topCustomer', label: t('departments.summary.topCustomer'), value: topCustomer?.count ?? '—', sub: topCustomer?.label,
      onClick: topCustomer ? gateDrillClick('departments', () => openSegment('customer', topCustomer, { customer: topCustomer.value })) : undefined },
    topLocation: { key: 'topLocation', label: t('departments.summary.topLocation'), value: topLocation?.count ?? '—', sub: topLocation?.label,
      onClick: topLocation ? gateDrillClick('departments', () => openSegment('location', topLocation, { location: topLocation.value })) : undefined },
    customersCount: { key: 'customersCount', label: t('departments.summary.customersCount'), value: customersCount },
    // Contact-coverage summary — the backend hasn't shipped this block yet;
    // these two slots hold their place with a dash so the strip's shape does
    // not change the day it lands.
    withContacts:    { key: 'withContacts',    label: t('departments.summary.withContacts'),    value: summary?.with_contacts ?? '—' },
    withoutContacts: { key: 'withoutContacts', label: t('departments.summary.withoutContacts'), value: summary?.without_contacts ?? '—' },
  }
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('departments').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('departments')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('departments'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* KPI strip — above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('departments.kpiOrderFellBack') : undefined} />
      )}

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
            {/* Created over time — week/day timeseries, bucket set server-side. Its
                own always-visible list sits beside it, never a shared overlay. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('departments.series')}</h3>
              <ReportChartWithDrillList drill={drills.series ?? null} placeholderLabel={t('departments.series')}
                chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('departments.axes.status')}</h3>
              <ReportChartWithDrillList drill={drills.status ?? null} placeholderLabel={t('departments.axes.status')}
                chart={colorBars('status', data.by_status.map(s => ({ ...s, color: s.color ?? null })))} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('departments.axes.customer')}</h3>
              <ReportChartWithDrillList drill={drills.customer ?? null} placeholderLabel={t('departments.axes.customer')}
                chart={plainBars('customer', data.by_customer)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('departments.axes.location')}</h3>
              <ReportChartWithDrillList drill={drills.location ?? null} placeholderLabel={t('departments.axes.location')}
                chart={plainBars('location', data.by_location)} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
