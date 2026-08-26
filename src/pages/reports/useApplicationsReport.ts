/**
 * useApplicationsReport — data layer for ApplicationsReport: loads
 * GET /reports/applications for the given period and exposes the four UI states.
 * RAPPORT-FILTERS-1: status/owner/branch/customer_id filters go through
 * `buildReportQueryParams` — the same helper the drilldown uses — so the report
 * and its lade can never describe two different filter sets. Via React Query:
 * the result is cached per period+filters (revisiting the same combo is instant)
 * and a stale request cancels (A-3). Mirrors useCandidatesReport.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { buildReportQueryParams, EMPTY_REPORT_FILTERS } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import type { ApplicationsReportData, ReportPeriod } from '@/types/analytics'

// Cached, cancel-aware fetch of the applications report for one period+filter combo.
export function useApplicationsReport(period: ReportPeriod, filters: ReportFilterState = EMPTY_REPORT_FILTERS) {
  const params = buildReportQueryParams(period, 'applications', filters)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'applications', params],
    queryFn: async ({ signal }) => ((await api.get('/reports/applications', { params, signal })).data ?? null) as ApplicationsReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError, refetch }
}
