// PieAxisCard — one report-grid pie-chart cell (title + PieChartCard + segment
// click), shared by every report that renders a lookup axis as a donut (both
// CustomersReport and OutreachReport show the customers status axis, byte for
// byte). Callers still own their own pickSegment/donutData wiring; this only
// removes the repeated ReportChartCard+PieChartCard JSX shell.
import type { ReactNode } from 'react'
import ReportChartCard from '../ReportChartCard'
import PieChartCard from '@/components/charts/PieChartCard'
import { donutData } from './chartData'
import type { DonutSegment } from './chartData'

export function PieAxisCard({ title, segments, onItemClick, span }: {
  title: ReactNode
  segments: DonutSegment[]
  onItemClick?: (seg: unknown) => void
  span?: 1 | 2
}) {
  return (
    <ReportChartCard span={span} title={title} chart={
      <PieChartCard {...donutData(segments)} onItemClick={onItemClick} />} />
  )
}
