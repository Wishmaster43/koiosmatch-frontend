/**
 * useUsageOverviewReport — data layer for the merged Verbruik overview: loads
 * GET /reports/usage for the given period and exposes the four UI states.
 * Mirrors useWorkflowsReport exactly (React Query, cached per period, stale
 * request cancels via the query signal), including the sibling `period` param
 * contract — the hub only sends presets, and an explicit from/to would win
 * server-side.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { UsageOverviewReportData, ReportPeriod } from '@/types/analytics'

export function useUsageOverviewReport(period: ReportPeriod) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'usage', period],
    queryFn: async ({ signal }) => ((await api.get('/reports/usage', { params: { period }, signal })).data ?? null) as UsageOverviewReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError, refetch }
}
