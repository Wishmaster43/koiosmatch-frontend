/**
 * VacancyReportAxes — the portie-pattern blocks of the vacancies report: the
 * created_at timeseries + the six distribution axes. RAPPORT-GEZICHT-WAVE2:
 * the coloured status lookup axis renders as a donut, the ranking axes
 * (customer/function/industry/owner/branch) as bar charts — the reference
 * CandidatesReport chart-type rule, never plain SegmentBars. Extracted from
 * VacanciesReport to keep the container thin (§3): the parent owns the
 * DrillSpec + drawer, this component only reports which segment was picked
 * together with its XOR param.
 * REPORTGRID-1: each block is its own ReportChartCard, laid out by the caller's
 * ReportGrid — this component renders a React fragment of grid items, not its
 * own outer card, so the caller controls the grid. Six half-width axis cards
 * is an EVEN count, so no odd-tail span={2} is needed here (unlike the
 * five-axis reference pages).
 */
import { useTranslation } from 'react-i18next'
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { ChartDatum } from '@/components/charts/chartTypes'
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

  // Donut datum builder — the coloured status lookup axis wears each value's
  // own colour, with the shared series as fallback (CandidatesReport idiom).
  const donutData = (segs: CandidateSegment[]): { data: ChartDatum[]; colors: string[] } => ({
    data: segs.map(s => ({ name: s.label, value: s.count, key: s.value })),
    colors: segs.map((s, i) => s.color ?? CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]),
  })
  const pickSegment = (axis: Axis, segs: CandidateSegment[]) =>
    gateDrillClick('vacancies', (d: unknown) => {
      const key = (d as { key?: string })?.key ?? (d as { payload?: { key?: string } })?.payload?.key
      const seg = segs.find(s => s.value === key)
      if (seg) onSegment(seg, { [axis]: seg.value })
    })

  // Ranking axis bar-datum builder: 'none'/'others' sentinels and orphaned
  // (deleted-lookup) values are all normal array entries — each drills on its
  // RAW value, exactly like any other segment (no special-casing).
  const barData = (segs: (CandidateSegment | ApplicationTopSegment)[]): ChartDatum[] =>
    segs.map(s => ({ name: s.label, value: s.count, key: s.value }))
  const pickBar = (axis: Axis, segs: (CandidateSegment | ApplicationTopSegment)[]) =>
    gateDrillClick('vacancies', (d: ChartDatum) => {
      const seg = segs.find(x => x.value === d.key)
      if (seg) onSegment(seg, { [axis]: seg.value })
    })

  // Owner axis (D2 shape: owner_id/name → the `owner` param).
  const ownerBarData = (segs: CandidateOwnerSegment[]): ChartDatum[] =>
    segs.map(s => ({ name: s.name, value: s.count, key: s.owner_id }))
  const pickOwnerBar = (segs: CandidateOwnerSegment[]) =>
    gateDrillClick('vacancies', (d: ChartDatum) => {
      const seg = segs.find(x => x.owner_id === d.key)
      if (seg) onSegment({ label: seg.name, count: seg.count }, { owner: seg.owner_id })
    })

  const onSeriesPick = gateDrillClick('vacancies', (dateKey: string) => {
    const pt = data.timeseries.series.find(p => p.date === dateKey)
    if (pt) onBucket(pt)
  })

  return (
    <>
      {/* Created over time — week/day timeseries, bucket set server-side. */}
      <ReportChartCard span={2} title={t('vacancies.series')}
        chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />

      {/* Coloured status lookup axis → donut (each slice wears its tenant colour). */}
      <ReportChartCard title={t('customers.axes.status')} chart={
        <PieChartCard {...donutData(data.by_status)} onItemClick={pickSegment('status', data.by_status)} />} />

      {/* Rankings → bar charts. */}
      <ReportChartCard title={t('applications.axes.customer')} chart={
        <BarChartCard data={barData(data.by_customer)} onBarClick={pickBar('customer', data.by_customer)} />} />
      {/* Function is a raw-string axis: the string is drill value AND label. */}
      <ReportChartCard title={t('intakes.by.function')} chart={
        <BarChartCard data={barData(data.by_function)} onBarClick={pickBar('function', data.by_function)} />} />
      <ReportChartCard title={t('customers.axes.industry')} chart={
        <BarChartCard data={barData(data.by_industry)} onBarClick={pickBar('industry', data.by_industry)} />} />
      <ReportChartCard title={t('customers.axes.owner')} chart={
        <BarChartCard data={ownerBarData(data.by_owner)} onBarClick={pickOwnerBar(data.by_owner)} />} />
      {/* VESTIGING-2: by_branch groups via the CUSTOMER's mirrored branch (not any
          vacancy field) and drills through the REPORT drill's `branch` param — never
          the /vacancies list filter. */}
      <ReportChartCard title={t('customers.axes.branch')} chart={
        <BarChartCard data={barData(data.by_branch)} onBarClick={pickBar('branch', data.by_branch)} />} />
    </>
  )
}
