/**
 * useTotalCompare (DRY round 11) — the raw useReportCompare call + cast +
 * `compare.kind !== 'off'` gate two report pages repeat directly (rather than
 * through useReportCompareData's compareBaseParams builder), because their
 * current window is NOT the plain report envelope's own top-level from/to
 * (Opportunities reads data?.period.from/to, Outreach reads data?.from/to —
 * see the call sites). `from`/`to`/`extraParams` stay page-supplied (rule B)
 * so that envelope difference stays visible at the call site.
 */
import { useReportCompare, type CompareMetric } from '../useReportCompare'
import type { CompareSlug } from '../reportCompareSupport'
import type { ReportCompareMode } from '../reportCompareMode'

export function useTotalCompare(
  compareSlug: CompareSlug | null,
  from: string | undefined,
  to: string | undefined,
  compare: ReportCompareMode,
  extraParams: Record<string, unknown> = {},
): CompareMetric | undefined {
  const { data: compareData } = useReportCompare(compareSlug, from, to, compare, extraParams)
  return compare.kind !== 'off' ? (compareData?.total as CompareMetric | undefined) : undefined
}
