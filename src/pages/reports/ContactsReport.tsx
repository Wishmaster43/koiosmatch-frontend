/**
 * ContactsReport — contact-persons report (GET /reports/contacts,
 * RAPPORTEN-SUITE-2). Mirrors TasksReport 1:1 (same envelope family, same calm
 * bars via the shared SegmentBars, window from the RESPONSE). Five-way XOR drill:
 * status|customer|function|location|department (+date, +bucket=week next to a
 * week bar). §9 privacy line: the KPI strip and every axis render ONLY label/
 * count — no email, phone or consent anywhere, and there is deliberately no
 * consent-percentage axis (never add one here).
 */
import { useEffect, useState } from 'react'
import { formatRatio } from '@/lib/formatters'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { DrillSpec } from './ReportDrillDrawer'
import { useContactsReport } from './useContactsReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportChartWithDrillList from './ReportChartWithDrillList'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateSegment, ApplicationTopSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

// The colour-carrying status axis vs. the four plain top-20 axes; both drill on
// their raw `value` via the same generic bar renderer below.
type ColorAxis = 'status'
type PlainAxis = 'customer' | 'function' | 'location' | 'department'
// Every axis shares the drill-key record with the timeseries.
type DrillKey = ColorAxis | PlainAxis | 'series'

export default function ContactsReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useContactsReport(period)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: any axis-segment bar or timeseries bucket explains itself (the
  // contact persons behind it + Koios advice). Exactly one XOR param per open
  // drill; the rows endpoint itself never carries email/phone (backend contract).
  const [drills, setDrills] = useState<Partial<Record<DrillKey, DrillSpec>>>({})
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openSegment = (key: DrillKey, seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrills(d => ({ ...d, [key]: {
      title: seg.label, value: seg.count, subtitle: windowSub(),
      rowsEndpoint: '/reports/contacts/drill', rowsParams: { ...xorParam, period },
      adviceEndpoint: '/reports/contacts/advice', adviceParams: { ...xorParam, period },
    } }))
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrills(d => ({ ...d, series: {
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the list then counts the WHOLE
    // week (bucket=week) so bar and list total always agree.
    rowsEndpoint: '/reports/contacts/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/contacts/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  } }))

  const colorBars = (axis: ColorAxis, segs: CandidateSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('contacts', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(axis, seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
  }

  // Plain top-20 axes (customer/function/location/department) — no lookup colour.
  const plainBars = (axis: PlainAxis, segs: ApplicationTopSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('contacts', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(axis, seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('contacts', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Default each section's list to its own top segment on mount so no panel is
  // ever blank — mirrors clicking that segment's own bar, never a client-side guess.
  useEffect(() => {
    if (!data) return
    const top = <T,>(segs: T[], count: (s: T) => number) => segs.length ? segs.reduce((a, b) => (count(b) > count(a) ? b : a)) : null
    const topStatus = top(data.by_status, s => s.count)
    const topCustomer = top(data.by_customer, s => s.count)
    const topFunction = top(data.by_function, s => s.count)
    const topLocation = top(data.by_location, s => s.count)
    const topDepartment = top(data.by_department, s => s.count)
    if (topStatus) openSegment('status', topStatus, { status: topStatus.value })
    if (topCustomer) openSegment('customer', topCustomer, { customer: topCustomer.value })
    if (topFunction) openSegment('function', topFunction, { function: topFunction.value })
    if (topLocation) openSegment('location', topLocation, { location: topLocation.value })
    if (topDepartment) openSegment('department', topDepartment, { department: topDepartment.value })
    if (data.timeseries.series.length) openBucket(data.timeseries.series[data.timeseries.series.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.from, data?.to])

  // KPI strip straight from the backend summary — total/primary/recent/never
  // contacted are all real counts, never derived or guessed on the client.
  const s = data?.summary
  // The four axis-coverage gaps ('none' bucket per axis) — real segments, each
  // still drillable exactly like its own bar.
  const withoutFunction   = data?.by_function.find(x => x.value === 'none')
  const withoutLocation   = data?.by_location.find(x => x.value === 'none')
  const withoutDepartment = data?.by_department.find(x => x.value === 'none')
  const withoutCustomer   = data?.by_customer.find(x => x.value === 'none')
  // Spares (REPORTS-KPI-SPARE-2): the biggest real ('none'/'others'-excluded)
  // segment of each existing axis — mirrors LocationsReport/DepartmentsReport's
  // own topCity/topCustomer pattern, real counts already in these same arrays.
  const top = (segs: ApplicationTopSegment[] | undefined) => (segs ?? [])
    .filter(s => s.value !== 'none' && s.value !== 'others')
    .reduce<ApplicationTopSegment | null>((best, s) => (!best || s.count > best.count ? s : best), null)
  const topCustomer   = top(data?.by_customer)
  const topFunction   = top(data?.by_function)
  const topLocation   = top(data?.by_location)
  const topDepartment = top(data?.by_department)
  const kpiByKey: Record<string, KpiSpec> = {
    total:            { key: 'total',            label: t('contacts.total'),            value: total },
    primary:          { key: 'primary',          label: t('contacts.summary.primary'),          value: s?.primary ?? 0 },
    withRecentContact: { key: 'withRecentContact', label: t('contacts.summary.withRecentContact'), value: s?.with_recent_contact ?? 0 },
    neverContacted:   { key: 'neverContacted',   label: t('contacts.summary.neverContacted'),   value: s?.never_contacted ?? 0 },
    // Derived ratio over two real summary fields — never a fabricated 0%.
    contactedRate: { key: 'contactedRate', label: t('contacts.summary.contactedRate'),
      value: s && total > 0 ? formatRatio(s.with_recent_contact / total) : '—' },
    withoutFunction: { key: 'withoutFunction', label: t('contacts.summary.withoutFunction'), value: withoutFunction?.count ?? 0,
      onClick: withoutFunction ? gateDrillClick('contacts', () => openSegment('function', withoutFunction, { function: 'none' })) : undefined },
    withoutLocation: { key: 'withoutLocation', label: t('contacts.summary.withoutLocation'), value: withoutLocation?.count ?? 0,
      onClick: withoutLocation ? gateDrillClick('contacts', () => openSegment('location', withoutLocation, { location: 'none' })) : undefined },
    withoutDepartment: { key: 'withoutDepartment', label: t('contacts.summary.withoutDepartment'), value: withoutDepartment?.count ?? 0,
      onClick: withoutDepartment ? gateDrillClick('contacts', () => openSegment('department', withoutDepartment, { department: 'none' })) : undefined },
    withoutCustomer: { key: 'withoutCustomer', label: t('contacts.summary.withoutCustomer'), value: withoutCustomer?.count ?? 0,
      onClick: withoutCustomer ? gateDrillClick('contacts', () => openSegment('customer', withoutCustomer, { customer: 'none' })) : undefined },
    topCustomer: { key: 'topCustomer', label: t('contacts.summary.topCustomer'), value: topCustomer?.count ?? '—', sub: topCustomer?.label,
      onClick: topCustomer ? gateDrillClick('contacts', () => openSegment('customer', topCustomer, { customer: topCustomer.value })) : undefined },
    topFunction: { key: 'topFunction', label: t('contacts.summary.topFunction'), value: topFunction?.count ?? '—', sub: topFunction?.label,
      onClick: topFunction ? gateDrillClick('contacts', () => openSegment('function', topFunction, { function: topFunction.value })) : undefined },
    topLocation: { key: 'topLocation', label: t('contacts.summary.topLocation'), value: topLocation?.count ?? '—', sub: topLocation?.label,
      onClick: topLocation ? gateDrillClick('contacts', () => openSegment('location', topLocation, { location: topLocation.value })) : undefined },
    topDepartment: { key: 'topDepartment', label: t('contacts.summary.topDepartment'), value: topDepartment?.count ?? '—', sub: topDepartment?.label,
      onClick: topDepartment ? gateDrillClick('contacts', () => openSegment('department', topDepartment, { department: topDepartment.value })) : undefined },
  }
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('contacts').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('contacts')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('contacts'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* KPI strip — contact-cohort health, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('contacts.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('contacts.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && total === 0}
          loadingLabel={t('contacts.loading')} errorLabel={t('contacts.error')} emptyLabel={t('contacts.empty')}
          onRetry={() => refetch()}
        />
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Created over time — week/day timeseries, bucket set server-side. Its own
                always-visible list sits beside it, never a shared overlay. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('contacts.series')}</h3>
              <ReportChartWithDrillList drill={drills.series ?? null} placeholderLabel={t('contacts.series')}
                chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('contacts.axes.status')}</h3>
              <ReportChartWithDrillList drill={drills.status ?? null} placeholderLabel={t('contacts.axes.status')}
                chart={colorBars('status', data.by_status.map(s => ({ ...s, color: s.color ?? null })))} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('contacts.axes.customer')}</h3>
              <ReportChartWithDrillList drill={drills.customer ?? null} placeholderLabel={t('contacts.axes.customer')}
                chart={plainBars('customer', data.by_customer)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('contacts.axes.function')}</h3>
              <ReportChartWithDrillList drill={drills.function ?? null} placeholderLabel={t('contacts.axes.function')}
                chart={plainBars('function', data.by_function)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('contacts.axes.location')}</h3>
              <ReportChartWithDrillList drill={drills.location ?? null} placeholderLabel={t('contacts.axes.location')}
                chart={plainBars('location', data.by_location)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('contacts.axes.department')}</h3>
              <ReportChartWithDrillList drill={drills.department ?? null} placeholderLabel={t('contacts.axes.department')}
                chart={plainBars('department', data.by_department)} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
