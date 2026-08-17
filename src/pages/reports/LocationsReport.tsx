/**
 * LocationsReport — customer-locations report (GET /reports/locations,
 * RAPPORTEN-SUITE-2). Mirrors CandidatesReport's drill-list pattern (
 * RAPPORTEN-DRILLLIST-1): every axis section and the timeseries own an
 * ALWAYS-VISIBLE list beside their chart (ReportChartWithDrillList), seeded
 * with that section's own top segment on mount, never a shared overlay.
 * Four-way XOR drill: status|customer|city|province (+date, +bucket=week
 * next to a week bar). No dedicated summary block ships server-side — the
 * KPI strip is derived ONLY from `total` + the `by_customer` axis totals
 * (an honest count, never a fabricated number).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatRatio } from '@/lib/formatters'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { DrillSpec } from './ReportDrillDrawer'
import { useLocationsReport } from './useLocationsReport'
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
type PlainAxis = 'customer' | 'city' | 'province'
type DrillKey = ColorAxis | PlainAxis | 'series'

export default function LocationsReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useLocationsReport(period)

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
      rowsEndpoint: '/reports/locations/drill', rowsParams: { ...xorParam, period },
      adviceEndpoint: '/reports/locations/advice', adviceParams: { ...xorParam, period },
    } }))
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrills(d => ({ ...d, series: {
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the list then counts the WHOLE
    // week (bucket=week) so bar and list total always agree.
    rowsEndpoint: '/reports/locations/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/locations/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  } }))

  const colorBars = (axis: ColorAxis, segs: CandidateSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('locations', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(axis, seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
  }

  // Plain top-20 axes (customer/city/province) — no lookup colour.
  const plainBars = (axis: PlainAxis, segs: ApplicationTopSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('locations', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(axis, seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('locations', (dateKey: string) => {
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
    const topCity     = top(data.by_city, s => s.count)
    const topProvince = top(data.by_province, s => s.count)
    if (topStatus)   openSegment('status', topStatus, { status: topStatus.value })
    if (topCustomer) openSegment('customer', topCustomer, { customer: topCustomer.value })
    if (topCity)     openSegment('city', topCity, { city: topCity.value })
    if (topProvince) openSegment('province', topProvince, { province: topProvince.value })
    if (data.timeseries.series.length) openBucket(data.timeseries.series[data.timeseries.series.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.from, data?.to])

  // KPI strip: total + an honest linked/unlinked split off the `by_customer`
  // axis's own 'none' bucket (real numbers, never invented ones).
  const withoutCustomer = data?.by_customer.find(s => s.value === 'none')?.count ?? 0
  const withCustomer    = total - withoutCustomer
  // The optional department-coverage summary — only rendered when the endpoint
  // actually sends it (never fabricated when the block is absent).
  const summary = data?.summary
  const withoutCity     = data?.by_city.find(s => s.value === 'none')
  const withoutProvince = data?.by_province.find(s => s.value === 'none')
  // Top real (non-'none') bar per axis — the biggest actual city/province, never
  // a hardcoded value.
  const topCity = data?.by_city.filter(s => s.value !== 'none').reduce<{ value: string; label: string; count: number } | null>(
    (top, s) => (!top || s.count > top.count) ? s : top, null)
  const topProvince = data?.by_province.filter(s => s.value !== 'none').reduce<{ value: string; label: string; count: number } | null>(
    (top, s) => (!top || s.count > top.count) ? s : top, null)
  // Exactly nine cards, always (Danny — the strip's footprint never reflows
  // between pages). `topCity`/`topProvince` and the department-coverage
  // summary are PERMANENT slots: while their underlying value is absent, the
  // card still renders (house dash, never a fabricated 0 or a missing slot)
  // and reclaims its normal number the moment the data exists.
  const kpiByKey: Record<string, KpiSpec> = {
    total:            { key: 'total',            label: t('locations.total'),            value: total },
    withCustomer:     { key: 'withCustomer',     label: t('locations.summary.withCustomer'),    value: withCustomer },
    withoutCustomer:  { key: 'withoutCustomer',  label: t('locations.summary.withoutCustomer'), value: withoutCustomer },
    withoutCity: { key: 'withoutCity', label: t('locations.summary.withoutCity'), value: withoutCity?.count ?? 0,
      onClick: withoutCity ? gateDrillClick('locations', () => openSegment('city', withoutCity, { city: 'none' })) : undefined },
    topCity: { key: 'topCity', label: t('locations.summary.topCity'), value: topCity?.count ?? '—', sub: topCity?.label,
      onClick: topCity ? gateDrillClick('locations', () => openSegment('city', topCity, { city: topCity.value })) : undefined },
    withoutProvince: { key: 'withoutProvince', label: t('locations.summary.withoutProvince'), value: withoutProvince?.count ?? 0,
      onClick: withoutProvince ? gateDrillClick('locations', () => openSegment('province', withoutProvince, { province: 'none' })) : undefined },
    topProvince: { key: 'topProvince', label: t('locations.summary.topProvince'), value: topProvince?.count ?? '—', sub: topProvince?.label,
      onClick: topProvince ? gateDrillClick('locations', () => openSegment('province', topProvince, { province: topProvince.value })) : undefined },
    // Department-coverage summary — the backend hasn't shipped this block yet;
    // these two slots hold their place with a dash so the strip's shape does
    // not change the day it lands.
    withDepartments:    { key: 'withDepartments',    label: t('locations.summary.withDepartments'),    value: summary?.with_departments ?? '—' },
    withoutDepartments: { key: 'withoutDepartments', label: t('locations.summary.withoutDepartments'), value: summary?.without_departments ?? '—' },
    // Spares (REPORTS-KPI-SPARE-2): `summary.with_contacts`/`without_contacts`
    // are real fields the endpoint already returns (LocationsReport::summary())
    // but the strip never surfaced — plus two honest coverage ratios over counts
    // already in the strip. All four hold a dash while `summary` is absent,
    // exactly like withDepartments/withoutDepartments above.
    withContacts:    { key: 'withContacts',    label: t('locations.summary.withContacts'),    value: summary?.with_contacts ?? '—' },
    withoutContacts: { key: 'withoutContacts', label: t('locations.summary.withoutContacts'), value: summary?.without_contacts ?? '—' },
    departmentCoverageRate: { key: 'departmentCoverageRate', label: t('locations.summary.departmentCoverageRate'),
      value: summary && total > 0 ? formatRatio(summary.with_departments / total) : '—' },
    contactCoverageRate: { key: 'contactCoverageRate', label: t('locations.summary.contactCoverageRate'),
      value: summary && total > 0 ? formatRatio(summary.with_contacts / total) : '—' },
  }
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('locations').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('locations')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('locations'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* KPI strip — above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('locations.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('locations.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && total === 0}
          loadingLabel={t('locations.loading')} errorLabel={t('locations.error')} emptyLabel={t('locations.empty')}
          onRetry={() => refetch()}
        />
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Created over time — week/day timeseries, bucket set server-side. Its
                own always-visible list sits beside it, never a shared overlay. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('locations.series')}</h3>
              <ReportChartWithDrillList drill={drills.series ?? null} placeholderLabel={t('locations.series')}
                chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('locations.axes.status')}</h3>
              <ReportChartWithDrillList drill={drills.status ?? null} placeholderLabel={t('locations.axes.status')}
                chart={colorBars('status', data.by_status.map(s => ({ ...s, color: s.color ?? null })))} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('locations.axes.customer')}</h3>
              <ReportChartWithDrillList drill={drills.customer ?? null} placeholderLabel={t('locations.axes.customer')}
                chart={plainBars('customer', data.by_customer)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('locations.axes.city')}</h3>
              <ReportChartWithDrillList drill={drills.city ?? null} placeholderLabel={t('locations.axes.city')}
                chart={plainBars('city', data.by_city)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('locations.axes.province')}</h3>
              <ReportChartWithDrillList drill={drills.province ?? null} placeholderLabel={t('locations.axes.province')}
                chart={plainBars('province', data.by_province)} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
