/**
 * VacancyReportAxes — the portie-pattern blocks of the vacancies report: the
 * created_at timeseries + the six distribution axes, all rendered through the
 * shared SegmentBars (never forked). Extracted from VacanciesReport to keep the
 * container thin (§3): the parent owns the DrillSpec + drawer, this component
 * only reports which segment was picked together with its XOR param.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import SegmentBars from './SegmentBars'
import { gateDrillClick } from './reportDrillGate'
import type {
  VacanciesReportData, CandidateSegment, CandidateOwnerSegment,
  ApplicationTopSegment, CandidateTimeseriesPoint,
} from '@/types/analytics'

const head: CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.04em', color: 'var(--text-muted)', margin: 0 }

// The plain single-value XOR axes; the key doubles as the drill/advice query param.
type Axis = 'status' | 'customer' | 'function' | 'industry' | 'branch'

export default function VacancyReportAxes({ data, onSegment, onBucket }: {
  data: VacanciesReportData
  onSegment: (seg: { label: string; count: number }, xorParam: Record<string, unknown>) => void
  onBucket: (pt: CandidateTimeseriesPoint) => void
}) {
  const { t } = useTranslation('analytics')

  // Generic axis-bar renderer: 'none'/'others' sentinels and orphaned
  // (deleted-lookup) values are all normal array entries — each drills on its
  // RAW value, exactly like any other segment (no special-casing, see SegmentBars).
  const bars = (axis: Axis, segs: (CandidateSegment | ApplicationTopSegment)[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('vacancies', (value: string) => {
      const seg = segs.find(x => x.value === value)
      if (seg) onSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(x => ({ key: x.value, label: x.label, count: x.count, color: 'color' in x ? x.color : null }))} />
  }

  // Owner axis (D2 shape: owner_id/name → the `owner` param).
  const ownerBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('vacancies', (value: string) => {
      const seg = segs.find(x => x.owner_id === value)
      if (seg) onSegment({ label: seg.name, count: seg.count }, { owner: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(x => ({ key: x.owner_id, label: x.name, count: x.count, color: null }))} />
  }

  const seriesMax = data.timeseries.series.reduce((m, p) => Math.max(m, p.value), 0)
  const onSeriesPick = gateDrillClick('vacancies', (dateKey: string) => {
    const pt = data.timeseries.series.find(p => p.date === dateKey)
    if (pt) onBucket(pt)
  })

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Created over time — week/day timeseries, bucket set server-side. */}
      <section>
        <h3 style={{ ...head, marginBottom: 10 }}>{t('vacancies.series')}</h3>
        <SegmentBars max={seriesMax} onPick={onSeriesPick}
          items={data.timeseries.series.map(p => ({ key: p.date, label: p.label, count: p.value, color: null }))} />
      </section>

      <section>
        <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.status')}</h3>
        {bars('status', data.by_status)}
      </section>

      <section>
        <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.customer')}</h3>
        {bars('customer', data.by_customer)}
      </section>

      {/* Function is a raw-string axis: the string is drill value AND label. */}
      <section>
        <h3 style={{ ...head, marginBottom: 10 }}>{t('intakes.by.function')}</h3>
        {bars('function', data.by_function)}
      </section>

      <section>
        <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.industry')}</h3>
        {bars('industry', data.by_industry)}
      </section>

      <section>
        <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.owner')}</h3>
        {ownerBars(data.by_owner)}
      </section>

      {/* VESTIGING-2: by_branch groups via the CUSTOMER's mirrored branch (not any
          vacancy field) and drills through the REPORT drill's `branch` param — never
          the /vacancies list filter. */}
      <section>
        <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.branch')}</h3>
        {bars('branch', data.by_branch)}
      </section>
    </div>
  )
}
