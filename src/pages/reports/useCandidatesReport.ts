/**
 * useCandidatesReport — data layer for CandidatesReport: loads GET /reports/candidates
 * for the given period and exposes the four UI states. Via React Query: the result is
 * cached per period (revisiting a period is instant) and a stale request cancels (A-3).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { CandidatesReportData, ReportPeriod } from '@/types/analytics'

export function useCandidatesReport(period: ReportPeriod) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'candidates', period],
    queryFn: async ({ signal }) => ((await api.get('/reports/candidates', { params: { period }, signal })).data ?? null) as CandidatesReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
