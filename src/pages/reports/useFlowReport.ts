/**
 * useFlowReport — data layer for FlowReport: loads GET /reports/flow for the given
 * period and exposes the four UI states. Via React Query: the result is cached per
 * period (revisiting a period is instant) and a stale request cancels (A-3).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { FlowReportData, ReportPeriod } from '@/types/analytics'

export function useFlowReport(period: ReportPeriod) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'flow', period],
    queryFn: async ({ signal }) => ((await api.get('/reports/flow', { params: { period }, signal })).data ?? null) as FlowReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
