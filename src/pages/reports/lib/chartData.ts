/**
 * chartData — shared chart datum builders (donut and bar) that transform
 * segment arrays into ChartDatum arrays with integrated colours.
 * Adopted by CandidatesReport, CustomersReport, VacancyReportAxes.
 */
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { ChartDatum } from '@/components/charts/chartTypes'

// CHART-FALLBACK-1 (Danny 17-09, "donut is zwart" on #reports.matches and #reports.outreach):
// this file used to carry its OWN fallback palette of `var(--color-chart-1..6)` tokens that
// no stylesheet defines, so every slice without a lookup colour painted an invalid fill
// (black). The one house series lives in components/charts/chartTypes; never a second copy.

export interface DonutSegment {
  label: string
  count: number
  value: string
  color?: string | null
}

export interface RankingSegment {
  label: string
  count: number
  value: string
}

export interface OwnerSegment {
  name: string
  count: number
  owner_id: string
}

/**
 * Build donut chart data from a segment array, wrapping each lookup value
 * in its own colour (with fallback to the house series).
 */
export function donutData(segs: DonutSegment[]): {
  data: ChartDatum[]
  colors: string[]
} {
  return {
    data: segs.map(s => ({ name: s.label, value: s.count, key: s.value })),
    colors: segs.map((s, i) => s.color ?? CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]),
  }
}

/**
 * Build bar chart data from a ranking segment array (rankings like people, orgs,
 * or free-text values use the plain house series, not lookup colours).
 */
export function barData(segs: RankingSegment[]): ChartDatum[] {
  return segs.map(s => ({ name: s.label, value: s.count, key: s.value }))
}

/**
 * Build bar chart data from an owner/assignee segment array. Each owner ID
 * becomes the chart key.
 */
export function ownerBarData(segs: OwnerSegment[]): ChartDatum[] {
  return segs.map(s => ({ name: s.name, value: s.count, key: s.owner_id }))
}
