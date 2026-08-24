/**
 * VacancyReportAxes — the portie-pattern blocks of the vacancies report: the
 * created_at timeseries + the six distribution axes, all rendered through the
 * shared SegmentBars (never forked). Extracted from VacanciesReport to keep the
 * container thin (§3): the parent owns the DrillSpec + drawer, this component
 * only reports which segment was picked together with its XOR param.
 * REPORTGRID-1: each block is its own ReportChartCard, laid out by the caller's
 * ReportGrid — this component renders a React fragment of grid items, not its
 * own outer card, so the caller controls the grid.
 */
import { useTranslation } from 'react-i18next'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import ReportChartCard from './ReportChartCard'
import { gateDrillClick } from './reportDrillGate'
import type {
  VacanciesReportData, CandidateSegment, CandidateOwnerSegment,
  ApplicationTopSegment, CandidateTimeseriesPoint,
} from '@/types/analytics'

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

  const onSeriesPick = gateDrillClick('vacancies', (dateKey: string) => {
    const pt = data.timeseries.series.find(p => p.date === dateKey)
    if (pt) onBucket(pt)
  })

  return (
    <>
      {/* Created over time — week/day timeseries, bucket set server-side. */}
      <ReportChartCard span={2} title={t('vacancies.series')}
        chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />

      <ReportChartCard title={t('customers.axes.status')} chart={bars('status', data.by_status)} />
      <ReportChartCard title={t('applications.axes.customer')} chart={bars('customer', data.by_customer)} />
      {/* Function is a raw-string axis: the string is drill value AND label. */}
      <ReportChartCard title={t('intakes.by.function')} chart={bars('function', data.by_function)} />
      <ReportChartCard title={t('customers.axes.industry')} chart={bars('industry', data.by_industry)} />
      <ReportChartCard title={t('customers.axes.owner')} chart={ownerBars(data.by_owner)} />
      {/* VESTIGING-2: by_branch groups via the CUSTOMER's mirrored branch (not any
          vacancy field) and drills through the REPORT drill's `branch` param — never
          the /vacancies list filter. */}
      <ReportChartCard title={t('customers.axes.branch')} chart={bars('branch', data.by_branch)} />
    </>
  )
}
