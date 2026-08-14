/**
 * useTasksReport — data layer for TasksReport: loads GET /reports/tasks for the
 * given period and exposes the four UI states. Via React Query: the result is
 * cached per period (revisiting a period is instant) and a stale request cancels
 * (A-3). Mirrors useOpportunitiesReport, including the sibling `period` param
 * contract (explicit from/to would win server-side; the hub only sends presets).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { TasksReportData, ReportPeriod } from '@/types/analytics'

export function useTasksReport(period: ReportPeriod) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'tasks', period],
    queryFn: async ({ signal }) => ((await api.get('/reports/tasks', { params: { period }, signal })).data ?? null) as TasksReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
