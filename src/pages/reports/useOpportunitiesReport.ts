/**
 * useOpportunitiesReport — data layer for OpportunitiesReport: loads GET
 * /reports/opportunities for the given period (+ optional filters, WAVE-1C —
 * status/owner/branch/customer + the value_min/value_max range) and exposes the
 * four UI states. Via React Query: the result is cached per period+filters
 * (revisiting the same combination is instant) and a stale request cancels
 * (A-3). Mirrors useCustomersReport / useVacanciesReport, including the sibling
 * `period` param contract.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { OpportunitiesReportData, ReportPeriod } from '@/types/analytics'
import { buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'

export function useOpportunitiesReport(period: ReportPeriod, filters?: ReportFilterState) {
  // buildReportQueryParams attaches status/owner_id/location_id/customer_id/
  // value_min/value_max only once 'opportunities' is on FILTERABLE_REPORT_IDS
  // (reportFilterParams.ts) — a no-op `{ period }` otherwise.
  const params = buildReportQueryParams(period, 'opportunities', filters)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'opportunities', params],
    queryFn: async ({ signal }) => ((await api.get('/reports/opportunities', { params, signal })).data ?? null) as OpportunitiesReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError, refetch }
}
