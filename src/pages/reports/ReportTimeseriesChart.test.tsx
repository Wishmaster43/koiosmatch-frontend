/**
 * ReportTimeseriesChart.test.tsx — the shared house line-chart wrapper every report's
 * timeseries now renders through (replaces the unreadable SegmentBars horizontal-bar
 * rendering for date series, Danny 14-08). Recharts' ResponsiveContainer needs real
 * layout to draw its SVG (unavailable in jsdom), so this asserts the two things that
 * are stable without it: the empty state still shows, and a populated fixture takes
 * the chart branch instead of falling back to "no data" — proving the points reached
 * the shared component. Click→drill-param wiring itself is covered per-report, where
 * this component is mocked exactly like WeeklyBarChartCard is in TrendsRow.test.tsx.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReportTimeseriesChart from './ReportTimeseriesChart'

describe('ReportTimeseriesChart', () => {
  it('shows the shared empty state for zero points', () => {
    render(<ReportTimeseriesChart series={[]} />)
    expect(screen.getByText('Geen data')).toBeInTheDocument()
  })

  it('takes the chart branch (not the empty state) for a populated fixture', () => {
    render(<ReportTimeseriesChart series={[
      { date: '2026-08-03', label: 'Wk 32', value: 5 },
      { date: '2026-08-10', label: 'Wk 33', value: 7 },
    ]} />)
    expect(screen.queryByText('Geen data')).not.toBeInTheDocument()
  })
})
