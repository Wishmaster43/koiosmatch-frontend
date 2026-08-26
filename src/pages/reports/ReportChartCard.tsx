/**
 * ReportChartCard (REPORTGRID-1, replaces ReportChartWithDrillList) — one
 * report section as a grid cell: title + chart, in the shared card shape
 * (ReportSectionCard/Body/Section). The old inline drill list beside the
 * chart is gone — clicking a segment now opens the shared ReportDrillDrawer
 * (same DrillSpec contract, same useReportDrill data layer), so a report page
 * keeps exactly one drill state instead of one per section.
 */
import type { ReactNode } from 'react'
import { ReportGridItem } from './ReportGrid'
import { ReportSectionCard, ReportSectionCardBody, ReportSection } from './ReportSectionCard'

// One report grid cell (title + chart) in the shared card shape; see the module doc comment above for the shared drill-drawer contract this replaced.
export default function ReportChartCard({ title, chart, span }: {
  title: ReactNode   // the section heading (uppercase muted label)
  chart: ReactNode   // the chart/segment picker — owns its own click handlers
  span?: 1 | 2        // 2 = full-width row (wide tables/timeseries)
}) {
  return (
    <ReportGridItem span={span}>
      <ReportSectionCard>
        <ReportSectionCardBody>
          <ReportSection title={title}>{chart}</ReportSection>
        </ReportSectionCardBody>
      </ReportSectionCard>
    </ReportGridItem>
  )
}
