/**
 * useVacanciesReport — data layer for VacanciesReport: loads GET /reports/vacancies
 * (portie-4 envelope: C-34 summary + rows, plus timeseries + segment axes) for the
 * given period and exposes the four UI states. `bucket` optionally overrides the
 * timeseries granularity (?bucket=day|week — omitted, the server picks by window
 * length). RAPPORT-FILTERS-1: status/owner/branch/customer_id filters go through
 * `buildReportQueryParams` — the same helper the drilldown uses — so the report
 * and its lade can never describe two different filter sets. Via React Query:
 * cached per period+filters+bucket, a stale request cancels (A-3).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { buildReportQueryParams, EMPTY_REPORT_FILTERS } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import type { VacanciesReportData, ReportPeriod } from '@/types/analytics'

// Cached, cancel-aware fetch of the vacancies report for one period+filter+bucket combo.
export function useVacanciesReport(period: ReportPeriod, filters: ReportFilterState = EMPTY_REPORT_FILTERS, bucket?: 'day' | 'week') {
  const params = { ...buildReportQueryParams(period, 'vacancies', filters), ...(bucket ? { bucket } : {}) }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'vacancies', params],
    queryFn: async ({ signal }) => ((await api.get('/reports/vacancies', { params, signal })).data ?? null) as VacanciesReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError, refetch }
}
