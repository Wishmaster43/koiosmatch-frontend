/**
 * ReportTimeseriesChart — the ONE line-chart wrapper every report's date timeseries
 * renders through (Danny 14-08: "ziet er niet uit die chart" — SegmentBars' horizontal
 * bars read as unreadable next to date labels for a time series). Wraps the shared
 * house `LineChartCard` (date on the x-axis, token colours, no ad-hoc styling) so
 * every report gets the identical calm chart instead of a per-report one-off.
 * Click behaviour is preserved exactly: a point still drills on its raw `date` key —
 * callers keep folding `bucket=week` into their own onPick handler (see each report's
 * `openBucket`), this wrapper only hands back the date.
 */
import LineChartCard from '@/components/charts/LineChartCard'
import type { ChartDatum } from '@/components/charts/chartTypes'

export interface ReportTimeseriesPoint { date: string; label: string; value: number }

// The one shared timeseries line chart every report renders through; a click hands back the point's raw date key so callers keep their own bucket logic (see file header).
export default function ReportTimeseriesChart({ series, onPick, unit, bucket }: {
  series: ReportTimeseriesPoint[]
  // Granularity of the series: a week bucket keeps the BE label ('wk 45'), a day bucket shows the date.
  bucket?: 'day' | 'week'
  onPick?: (dateKey: string) => void
  unit?: string
}) {
  // The house chart only knows generic `name`/`value` data points; the ISO date is the
  // category (DD-MM ticks, DD-MM-YYYY tooltip, AXIS-TICK-DATE-1) and `key` carries it back for the drill click.
  // A week bucket stays a week: the BE label ('wk 45') is the category and no date axis is applied.
  const isWeek = bucket === 'week'
  const data: ChartDatum[] = series.map(p => ({ name: isWeek ? p.label : p.date, value: p.value, key: p.date }))

  // Recharts hands the dot's own props to onClick — the datum can arrive either
  // directly or nested under `payload`, so read the date key defensively off both.
  const onItemClick = onPick ? (d: unknown) => {
    const rec = d as { key?: string; payload?: { key?: string } }
    const key = rec?.key ?? rec?.payload?.key
    if (key) onPick(key)
  } : undefined

  return <LineChartCard data={data} onItemClick={onItemClick} unit={unit} height={200} dateAxis={!isWeek} />
}
