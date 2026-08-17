/**
 * TenantUsageBreakdownChart — the picture beside the uitsplitsing table (Danny
 * 17-08: "kan dat rechts naast de tabel een grafiek?"). It charts the SAME rows
 * the table lists, on the SAME measure the table sorts by (Inkoop), so the
 * chart's biggest slice is always the table's top row — two views that can never
 * disagree.
 *
 * The chart TYPE follows the axis, because one shape does not fit both:
 *   - day → a line in date order. A share chart of 31 days says nothing, and
 *     re-sorting days by size would destroy the one thing a day axis carries.
 *   - activity / model / user → a share donut, which is what "who eats the
 *     budget" actually asks.
 *
 * The donut's legend lists one row per slice, so it is capped at the top eight
 * with an explicit "Overig (N)" bucket — an unbounded legend is the very thing
 * this screen was just fixed for. The bucket is named and counted rather than
 * silently dropped, and the full detail is in the table right next to it.
 */
import { useTranslation } from 'react-i18next'
import PieChartCard from '@/components/charts/PieChartCard'
import LineChartCard from '@/components/charts/LineChartCard'
import { useDateFormat } from '@/lib/datetime'
import type { ChartDatum } from '@/components/charts/chartTypes'
import type { AdminUsageDetailsAxis, AdminUsageDetailsRow } from '@/types/billingUsage'

// How many slices the donut names before the rest becomes one honest bucket.
const TOP_SLICES = 8

// The charted measure: the purchase side, matching the table's own default sort.
// Falls back to the raw cost sum when the server omits the split.
const purchaseOf = (r: AdminUsageDetailsRow) => r.sale?.purchase ?? r.cost ?? 0

export default function TenantUsageBreakdownChart({ axis, rows }: {
  axis: AdminUsageDetailsAxis
  rows: AdminUsageDetailsRow[]
}) {
  const { t } = useTranslation('settings')
  const { formatDate } = useDateFormat()
  const title = t('usage.breakdown.chartTitle', { axis: t(`usage.breakdown.axis.${axis}`).toLowerCase() })

  // Day axis: chronological, never re-sorted by size — the order IS the message.
  if (axis === 'day') {
    const data: ChartDatum[] = [...rows]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(r => ({ name: formatDate(r.key), value: purchaseOf(r), key: r.key }))
    return <LineChartCard title={title} data={data} height={240} unit="€" />
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
      key: '__other__',
    })
  }

  return <PieChartCard title={title} data={data} size={170} unit="€" />
}
