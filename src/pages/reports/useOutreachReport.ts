/**
 * useOutreachReport — data layer for OutreachReport: loads GET /reports/outreach
 * for the given period (+ WAVE 1c status/owner/branch panel filters) and exposes
 * the four UI states. Via React Query: the result is cached per period+filters
 * (revisiting the same combo is instant) and a stale request cancels (A-3).
 * Portie 6 gave the endpoint the sibling ?period= preset (echoed in the response;
 * the actual window still arrives as from/to IN the response). Params go through
 * `buildReportQueryParams`, same as every other filterable report — outreach has
 * no dimension of its own beyond status/owner/branch (OutreachReport.php never
 * reads a per-page extra key), so this only ever forwards those three plus period.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { buildReportQueryParams, EMPTY_REPORT_FILTERS } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import type { OutreachReportData, ReportPeriod } from '@/types/analytics'

export function useOutreachReport(period: ReportPeriod, filters: ReportFilterState = EMPTY_REPORT_FILTERS) {
  const params = buildReportQueryParams(period, 'outreach', filters)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'outreach', params],
    queryFn: async ({ signal }) => ((await api.get('/reports/outreach', { params, signal })).data ?? null) as OutreachReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError, refetch }
}
