/**
 * useOutreachReport — data layer for OutreachReport: loads GET /reports/outreach
 * for the given period and exposes the four UI states. Via React Query: cached per
 * period (revisiting a period is instant) and a stale request cancels (A-3).
 * Portie 6 gave the endpoint the sibling ?period= preset (echoed in the response;
 * the actual window still arrives as from/to IN the response), so this hook now
 * sends `period` like useOpportunitiesReport / useTasksReport.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { OutreachReportData, ReportPeriod } from '@/types/analytics'

export function useOutreachReport(period: ReportPeriod) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'outreach', period],
    queryFn: async ({ signal }) => ((await api.get('/reports/outreach', { params: { period }, signal })).data ?? null) as OutreachReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
