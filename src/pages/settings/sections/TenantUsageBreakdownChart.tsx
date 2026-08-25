/**
 * TenantUsageBreakdownChart — the picture beside the breakdown table (Danny
 * 17-08: "kan dat rechts naast de tabel een grafiek?" — "can we get a chart
 * next to the table on the right?"). It charts the SAME rows
 * the table lists, on the SAME measure the table sorts by (Inkoop — cost price), so the
 * chart's biggest slice is always the table's top row — two views that can never
 * disagree.
 *
 * The chart TYPE follows the axis, because one shape does not fit both:
 *   - day → a BAR chart in date order (TENANT-USAGE-POLISH-1: was a line, now
 *     consistent with the tenant-facing usage/UsageDayChart bar convention). A
 *     share chart of 31 days says nothing, and re-sorting days by size would
 *     destroy the one thing a day axis carries — so the bars stay chronological.
 *   - activity / model / user → a share donut, which is what "who eats the
 *     budget" actually asks.
 *
 * The donut's legend lists one row per slice, so it is capped at the top eight
 * with an explicit "Overig (N)" bucket — an unbounded legend is the very thing
 * this screen was just fixed for. The bucket is named and counted rather than
 * silently dropped, and the full detail is in the table right next to it.
 *
 * TENANT-USAGE-POLISH-1: a pie slice or a day bar reports its key back via
 * `onSelectKey` so the table below can filter/highlight to it — the "Overig"
 * bucket has no real row behind it, so a click there is a no-op.
 */
import { useTranslation } from 'react-i18next'
import PieChartCard from '@/components/charts/PieChartCard'
import WeeklyBarChartCard from '@/components/charts/WeeklyBarChartCard'
import { useDateFormat } from '@/lib/datetime'
import type { ChartDatum } from '@/components/charts/chartTypes'
import type { AdminUsageDetailsAxis, AdminUsageDetailsRow } from '@/types/billingUsage'

// How many slices the donut names before the rest becomes one honest bucket.
const TOP_SLICES = 8
const OTHER_KEY = '__other__'

// The charted measure: the purchase side, matching the table's own default sort.
// Falls back to the raw cost sum when the server omits the split.
const purchaseOf = (r: AdminUsageDetailsRow) => r.sale?.purchase ?? r.cost ?? 0

// Extract a clicked datum's row key from either chart's click payload shape
// (pie hands back the raw entry/`payload`, the bar hands back the row object).
const pickKey = (d: unknown): string | undefined => {
  const o = d as { key?: string; payload?: { key?: string } } | null | undefined
  return o?.key ?? o?.payload?.key
}

export default function TenantUsageBreakdownChart({ axis, rows, onSelectKey }: {
  axis: AdminUsageDetailsAxis
  rows: AdminUsageDetailsRow[]
  // Fires with the clicked row's real key, or undefined for the "Overig" bucket
  // (nothing to filter to). Optional so a caller without drill-down still works.
  onSelectKey?: (key: string | undefined) => void
}) {
  const { t } = useTranslation('settings')
  const { formatDate } = useDateFormat()
  const title = t('usage.breakdown.chartTitle', { axis: t(`usage.breakdown.axis.${axis}`).toLowerCase() })

  const handleClick = (d: unknown) => {
    const key = pickKey(d)
    if (key && key !== OTHER_KEY) onSelectKey?.(key)
  }

  // Day axis: chronological, never re-sorted by size — the order IS the message.
  if (axis === 'day') {
    const data: ChartDatum[] = [...rows]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(r => ({ name: formatDate(r.key), value: purchaseOf(r), key: r.key }))
    return (
      <WeeklyBarChartCard title={title} data={data}
        series={[{ key: 'value', label: title, color: 'var(--color-primary)' }]}
        height={240}
        onBarClick={onSelectKey ? (row) => handleClick(row) : undefined} />
    )
  }

  // Categorical axes: biggest first, then everything below the cut folded into
  // one named bucket so the legend cannot grow with the tenant's user count.
  const sorted = [...rows].sort((a, b) => purchaseOf(b) - purchaseOf(a))
  const head = sorted.slice(0, TOP_SLICES)
  const tail = sorted.slice(TOP_SLICES)
  const data: ChartDatum[] = head.map(r => ({
    name: axis === 'user' ? (r.label || r.key) : r.key,
    value: purchaseOf(r),
    key: r.key,
  }))
  if (tail.length) {
    data.push({
      name: t('usage.breakdown.chartOther', { count: tail.length }),
      value: tail.reduce((s, r) => s + purchaseOf(r), 0),
      key: OTHER_KEY,
    })
  }

  // No legend: it would repeat the table standing right next to it, row for row
  // and value for value, and that repetition is what pushed the table's own
  // Inkoop/Verkoop columns off screen on a laptop. The ring shows the SHAPE, the
  // table carries the numbers, the tooltip covers "which slice is that".
  return (
    <PieChartCard title={title} data={data} size={170} unit="€" hideLegend
      onItemClick={onSelectKey ? handleClick : undefined} />
  )
}
