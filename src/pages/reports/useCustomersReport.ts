import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { buildReportQueryParams, EMPTY_REPORT_FILTERS } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import type { CustomersReportData, ReportPeriod } from '@/types/analytics'

/**
 * useCustomersReport — data layer for CustomersReport: loads GET /reports/customers
 * for the given period (+ RAPPORT-FILTERS-1 status/owner/branch filters) and exposes the
 * four UI states. Via React Query: the result is cached per period+filters (revisiting
 * the same combo is instant) and a stale request cancels (A-3). Params go through
 * `buildReportQueryParams` — the same helper the drilldown uses — so the report and its
 * lade can never describe two different filter sets. Mirrors useCandidatesReport.
 *
 * `phaseFilter` (RAPPORTEN-CONSOLIDATIE-1) is the optional extra `phase` param the
 * Klanten page's Klanten/Prospects switch layers on top of the panel filters — a real
 * SERVER-side narrowing, included in the query key so the two populations cache
 * separately.
 */
export function useCustomersReport(
  period: ReportPeriod,
  filters: ReportFilterState = EMPTY_REPORT_FILTERS,
  phaseFilter?: string | null,
) {
  const params = { ...buildReportQueryParams(period, 'customers', filters), ...(phaseFilter ? { phase: phaseFilter } : {}) }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'customers', params],
    queryFn: async ({ signal }) => ((await api.get('/reports/customers', { params, signal })).data ?? null) as CustomersReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError, refetch }
}
