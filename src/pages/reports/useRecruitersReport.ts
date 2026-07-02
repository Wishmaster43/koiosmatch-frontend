/**
 * useRecruitersReport — data layer for RecruitersReport: loads GET /reports/recruiters
 * for the given period and exposes the four UI states. Via React Query: the result is
 * cached per period (revisiting a period is instant) and a stale request cancels (A-3).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { RecruitersReportData, ReportPeriod } from '@/types/analytics'

export function useRecruitersReport(period: ReportPeriod) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'recruiters', period],
    queryFn: async ({ signal }) => ((await api.get('/reports/recruiters', { params: { period }, signal })).data ?? null) as RecruitersReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
