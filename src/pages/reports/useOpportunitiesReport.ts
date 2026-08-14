/**
 * useOpportunitiesReport — data layer for OpportunitiesReport: loads GET
 * /reports/opportunities for the given period and exposes the four UI states.
 * Via React Query: the result is cached per period (revisiting a period is
 * instant) and a stale request cancels (A-3). Mirrors useCustomersReport /
 * useVacanciesReport, including the sibling `period` param contract.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { OpportunitiesReportData, ReportPeriod } from '@/types/analytics'

export function useOpportunitiesReport(period: ReportPeriod) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'opportunities', period],
    queryFn: async ({ signal }) => ((await api.get('/reports/opportunities', { params: { period }, signal })).data ?? null) as OpportunitiesReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
