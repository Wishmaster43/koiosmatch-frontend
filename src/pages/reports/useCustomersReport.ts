/**
 * useCustomersReport — data layer for CustomersReport: loads GET /reports/customers
 * for the given period and exposes the four UI states. Via React Query: the result is
 * cached per period (revisiting a period is instant) and a stale request cancels (A-3).
 * Mirrors useCandidatesReport / useApplicationsReport.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { CustomersReportData, ReportPeriod } from '@/types/analytics'

export function useCustomersReport(period: ReportPeriod) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'customers', period],
    queryFn: async ({ signal }) => ((await api.get('/reports/customers', { params: { period }, signal })).data ?? null) as CustomersReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
