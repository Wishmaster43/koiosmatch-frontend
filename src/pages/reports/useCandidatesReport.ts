/**
 * useCandidatesReport — data layer for CandidatesReport: loads GET /reports/candidates
 * for the given period (+ RAPPORT-FILTERS-1 status/owner/branch filters) and exposes the
 * four UI states. Via React Query: the result is cached per period+filters (revisiting
 * the same combo is instant) and a stale request cancels (A-3). Params go through
 * `buildReportQueryParams` — the same helper the drilldown uses — so the report and its
 * lade can never describe two different filter sets.
 *
 * `phaseFilter` (RAPPORTEN-CONSOLIDATIE-1) is the optional extra `phase` param the
 * Instroom page's Kandidaten/Leads switch layers on top of the panel filters —
 * a real SERVER-side narrowing (never a client-side slice of the unfiltered
 * payload), included in the query key so the two populations cache separately.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { buildReportQueryParams, EMPTY_REPORT_FILTERS } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import type { CandidatesReportData, ReportPeriod } from '@/types/analytics'

// Cached, cancellable candidates-report fetch; phaseFilter joins the query key so the Candidates and Leads populations never share a stale cache entry (see file header).
export function useCandidatesReport(
  period: ReportPeriod,
  filters: ReportFilterState = EMPTY_REPORT_FILTERS,
  phaseFilter?: string | null,
) {
  const params = { ...buildReportQueryParams(period, 'candidates', filters), ...(phaseFilter ? { phase: phaseFilter } : {}) }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'candidates', params],
    queryFn: async ({ signal }) => ((await api.get('/reports/candidates', { params, signal })).data ?? null) as CandidatesReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError, refetch }
}
