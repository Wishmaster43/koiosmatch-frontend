/**
 * useMatchesReport — data layer for MatchesReport: loads GET /reports/matches for
 * the given period and exposes the four UI states. RAPPORT-FILTERS-1: status/
 * owner/branch filters go through `buildReportQueryParams` — the same helper the
 * drilldown uses — so the report and its lade can never describe two different
 * filter sets (no `customer_id[]` here: matches' singular `customer_id` param is
 * already a different, existing slice — see the report service's own docblock).
 * Via React Query: the result is cached per period+filters and a stale request
 * cancels (A-3).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { buildReportQueryParams, EMPTY_REPORT_FILTERS } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import type { MatchesReportData, ReportPeriod } from '@/types/analytics'

export function useMatchesReport(period: ReportPeriod, filters: ReportFilterState = EMPTY_REPORT_FILTERS) {
  const params = buildReportQueryParams(period, 'matches', filters)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'matches', params],
    queryFn: async ({ signal }) => ((await api.get('/reports/matches', { params, signal })).data ?? null) as MatchesReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
