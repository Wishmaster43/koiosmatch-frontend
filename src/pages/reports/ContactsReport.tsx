/**
 * ContactsReport — contact-persons report (GET /reports/contacts,
 * RAPPORTEN-SUITE-2). Mirrors TasksReport 1:1 (same envelope family, same calm
 * bars via the shared SegmentBars, window from the RESPONSE). Five-way XOR drill:
 * status|customer|function|location|department (+date, +bucket=week next to a
 * week bar). §9 privacy line: the KPI strip and every axis render ONLY label/
 * count — no email, phone or consent anywhere, and there is deliberately no
 * consent-percentage axis (never add one here).
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useContactsReport } from './useContactsReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateSegment, ApplicationTopSegment, CandidateTimeseriesPoint } from '@/types/analytics'

const card:  CSSProperties = { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }
const state: CSSProperties = { textAlign: 'center', padding: 40, fontSize: 13 }
const head:  CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.04em', color: 'var(--text-muted)', margin: 0 }

// The colour-carrying status axis vs. the four plain top-20 axes; both drill on
// their raw `value` via the same generic bar renderer below.
type ColorAxis = 'status'
type PlainAxis = 'customer' | 'function' | 'location' | 'department'

export default function ContactsReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error } = useContactsReport(period)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: any axis-segment bar or timeseries bucket explains itself (the
  // contact persons behind it + Koios advice). Exactly one XOR param per open
  // drill; the rows endpoint itself never carries email/phone (backend contract).
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) => setDrill({
    title: seg.label, value: seg.count, subtitle: windowSub(),
    rowsEndpoint: '/reports/contacts/drill', rowsParams: { ...xorParam, period },
    adviceEndpoint: '/reports/contacts/advice', adviceParams: { ...xorParam, period },
  })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/contacts/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/contacts/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  })

  const colorBars = (axis: ColorAxis, segs: CandidateSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('contacts', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
  }

  // Plain top-20 axes (customer/function/location/department) — no lookup colour.
  const plainBars = (axis: PlainAxis, segs: ApplicationTopSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('contacts', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('contacts', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // KPI strip straight from the backend summary — total/primary/recent/never
  // contacted are all real counts, never derived or guessed on the client.
  const s = data?.summary
  const kpis: KpiSpec[] = [
    { key: 'total',            label: t('contacts.total'),            value: total },
    { key: 'primary',          label: t('contacts.summary.primary'),          value: s?.primary ?? 0 },
    { key: 'withRecentContact', label: t('contacts.summary.withRecentContact'), value: s?.with_recent_contact ?? 0 },
    { key: 'neverContacted',   label: t('contacts.summary.neverContacted'),   value: s?.never_contacted ?? 0 },
  ]

  return (
    <div>
      {/* KPI strip — contact-cohort health, above the tabs (candidate-page order) */}
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
          {t('contacts.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('contacts.loading')}</div>}
        {error && !loading && <div style={{ ...state, color: 'var(--color-danger)' }}>{t('contacts.error')}</div>}
        {!loading && !error && total === 0 && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('contacts.empty')}</div>}
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Created over time — week/day timeseries, bucket set server-side. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('contacts.series')}</h3>
              <ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('contacts.axes.status')}</h3>
              {colorBars('status', data.by_status.map(s => ({ ...s, color: s.color ?? null })))}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('contacts.axes.customer')}</h3>
              {plainBars('customer', data.by_customer)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('contacts.axes.function')}</h3>
              {plainBars('function', data.by_function)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('contacts.axes.location')}</h3>
              {plainBars('location', data.by_location)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('contacts.axes.department')}</h3>
              {plainBars('department', data.by_department)}
            </section>
          </div>
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked segment/bucket + Koios advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
