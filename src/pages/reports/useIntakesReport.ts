/**
 * useIntakesReport — data layer for IntakesReport: loads GET /reports/intakes for
 * the given period (mapped to the endpoint's `bucket`). Exposes the four UI states.
 * Via React Query: cached per period (revisiting is instant) + stale request cancels (A-3).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { IntakesReportData, ReportPeriod } from '@/types/analytics'

export function useIntakesReport(period: ReportPeriod) {
  // The intakes endpoint groups by `bucket` (day/week/month) = the shared period control.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'intakes', period],
    queryFn: async ({ signal }) => ((await api.get('/reports/intakes', { params: { bucket: period }, signal })).data ?? null) as IntakesReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
