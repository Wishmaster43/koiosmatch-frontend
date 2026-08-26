/**
 * reportCompareAggregate — sums one diffed field across a compare-diffed row
 * list into ONE team-total {current, previous, delta, delta_pct} metric.
 *
 * Why this exists: ReportComparator only diffs fields the backend's run()
 * response actually carries — for a per-manager report that means each ROW's
 * own numeric fields (see AccountManagersReport.php), never a top-level team
 * total (unlike e.g. candidates' scalar `total`). The plain (non-compare) KPI
 * band already sums `row.<field>` across rows client-side; this is the same
 * arithmetic extended to the diffed current/previous/delta triple — a sum of
 * REAL numbers the backend already computed, never a fabricated figure.
 * delta_pct follows the SAME null-on-zero-previous rule as ReportComparator's
 * own metric() (never a fabricated 0%/Infinity% when the previous sum is zero).
 */
import type { CompareMetric } from './useReportCompare'

// A compare-diffed row: every original field replaced by its {current,previous,
// delta,delta_pct} pair, except the identifier/label which stay plain strings.
export type CompareDiffedRow = Record<string, CompareMetric | string>

// Sums one diffed field across every row into a single team-total metric, applying the same null-on-zero-previous rule as the per-row diff.
export function sumCompareMetric(rows: CompareDiffedRow[], field: string): CompareMetric {
  let current = 0
  let previous = 0
  for (const row of rows) {
    const metric = row[field]
    if (metric && typeof metric === 'object') {
      current += metric.current
      previous += metric.previous
    }
  }
  const delta = current - previous
  const delta_pct = previous === 0 ? null : (delta / previous) * 100
  return { current, previous, delta, delta_pct }
}
