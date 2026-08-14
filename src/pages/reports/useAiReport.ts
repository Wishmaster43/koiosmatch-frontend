/**
 * useAiReport — data layer for AiReport: loads GET /reports/ai for the given
 * period and exposes the four UI states. Via React Query: the result is cached
 * per period (revisiting a period is instant) and a stale request cancels (A-3).
 * Mirrors useTasksReport, including the sibling `period` param contract
 * (explicit from/to would win server-side; the hub only sends presets). There is
 * deliberately no drill hook counterpart — /reports/ai has no /drill endpoint.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { AiReportData, ReportPeriod } from '@/types/analytics'

export function useAiReport(period: ReportPeriod) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'ai', period],
    queryFn: async ({ signal }) => ((await api.get('/reports/ai', { params: { period }, signal })).data ?? null) as AiReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError, refetch }
}
