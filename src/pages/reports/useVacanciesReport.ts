/**
 * useVacanciesReport — data layer for VacanciesReport: loads GET /reports/vacancies
 * for the given period and exposes the four UI states. Via React Query: the result is
 * cached per period (revisiting a period is instant) and a stale request cancels (A-3).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { VacanciesReportData, ReportPeriod } from '@/types/analytics'

export function useVacanciesReport(period: ReportPeriod) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'vacancies', period],
    queryFn: async ({ signal }) => ((await api.get('/reports/vacancies', { params: { period }, signal })).data ?? null) as VacanciesReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
