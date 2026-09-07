/**
 * useReportCompareData — wrapper for RAPPORT-COMPARE-1 compare-window wiring.
 * Takes period/reportKey/filters and data, builds compareBaseParams internally,
 * calls the low-level useReportCompare, and extracts totalCompare. Adopted on
 * six report pages (Applications/Matches/Tasks/Vacancies/Candidates/Customers).
 */
import type { ReportPeriod } from '@/types/analytics'
import type { ReportFilterState } from '../reportFilterParams'
import { buildReportQueryParams } from '../reportFilterParams'
import { getCompareSlug } from '../reportCompareSupport'
import { useReportCompare } from '../useReportCompare'
import type { ReportCompareMode } from '../reportCompareMode'

// Export the CompareMetric type for typing totalCompare in the page.
export type { CompareMetric as ReportCompareTotalMetric } from '../useReportCompare'

export interface CompareDataResult {
  totalCompare?: {
    current: number
    previous: number
    delta: number
    delta_pct: number | null
  } | undefined
  compareData: unknown
  loading: boolean
  error: boolean
}

export function useReportCompareData(
  period: ReportPeriod,
  reportKey: string,
  filters: ReportFilterState | undefined,
  data: { from?: string; to?: string } | null | undefined,
  compare: ReportCompareMode,
  extraParams?: Record<string, unknown>,
  // Reports with several views (candidates, customers) resolve their compare slug PER
  // VIEW; leaving it out yields a null slug and silently no compare request.
  view?: string,
): CompareDataResult {
  // Build compareBaseParams: the same filter set + period + any extra params.
  const compareBaseParams = { ...buildReportQueryParams(period, reportKey, filters ?? { status: [], ownerId: [], locationId: [], customerId: [] }), ...extraParams }

  // Get the report's own compare slug (null if unsupported).
  const compareSlug = getCompareSlug(reportKey as unknown as Parameters<typeof getCompareSlug>[0], view)

  // Call the low-level hook with the built params.
  const { data: compareData, loading, error } = useReportCompare(compareSlug, data?.from, data?.to, compare, compareBaseParams)

  // Extract totalCompare when compare mode is active.
  const totalCompare = compare.kind !== 'off' ? (compareData?.total as { current: number; previous: number; delta: number; delta_pct: number | null } | undefined) : undefined

  return { totalCompare, compareData, loading, error }
}
