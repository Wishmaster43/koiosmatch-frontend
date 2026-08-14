/**
 * useApplicationsReport — data layer for ApplicationsReport: loads
 * GET /reports/applications for the given period and exposes the four UI states.
 * Via React Query: the result is cached per period (revisiting a period is
 * instant) and a stale request cancels (A-3). Mirrors useCandidatesReport.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ApplicationsReportData, ReportPeriod } from '@/types/analytics'

export function useApplicationsReport(period: ReportPeriod) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'applications', period],
    queryFn: async ({ signal }) => ((await api.get('/reports/applications', { params: { period }, signal })).data ?? null) as ApplicationsReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
