/**
 * useVacanciesReport — data layer for VacanciesReport: loads GET /reports/vacancies
 * (portie-4 envelope: C-34 summary + rows, plus timeseries + segment axes) for the
 * given period and exposes the four UI states. `bucket` optionally overrides the
 * timeseries granularity (?bucket=day|week — omitted, the server picks by window
 * length). Via React Query: cached per period+bucket, a stale request cancels (A-3).
 * Mirrors useCustomersReport / useApplicationsReport.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { VacanciesReportData, ReportPeriod } from '@/types/analytics'

export function useVacanciesReport(period: ReportPeriod, bucket?: 'day' | 'week') {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'vacancies', period, bucket ?? null],
    queryFn: async ({ signal }) => ((await api.get('/reports/vacancies',
      { params: { period, ...(bucket ? { bucket } : {}) }, signal })).data ?? null) as VacanciesReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
