/**
 * useMatchesReport — data layer for MatchesReport: loads GET /reports/matches for
 * the given period and exposes the four UI states. Via React Query: the result is
 * cached per period (revisiting a period is instant) and a stale request cancels (A-3).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { MatchesReportData, ReportPeriod } from '@/types/analytics'

export function useMatchesReport(period: ReportPeriod) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'matches', period],
    queryFn: async ({ signal }) => ((await api.get('/reports/matches', { params: { period }, signal })).data ?? null) as MatchesReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
