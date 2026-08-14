/**
 * useTasksReport — data layer for TasksReport: loads GET /reports/tasks for the
 * given period and exposes the four UI states. RAPPORT-FILTERS-1: status/owner/
 * branch filters go through `buildReportQueryParams` — the same helper the
 * drilldown uses — so the report and its lade can never describe two different
 * filter sets (no `customer_id[]` here: tasks carry no customer column). Via
 * React Query: the result is cached per period+filters and a stale request
 * cancels (A-3). Mirrors useOpportunitiesReport, including the sibling `period`
 * param contract (explicit from/to would win server-side; the hub only sends presets).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { buildReportQueryParams, EMPTY_REPORT_FILTERS } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import type { TasksReportData, ReportPeriod } from '@/types/analytics'

export function useTasksReport(period: ReportPeriod, filters: ReportFilterState = EMPTY_REPORT_FILTERS) {
  const params = buildReportQueryParams(period, 'tasks', filters)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'tasks', params],
    queryFn: async ({ signal }) => ((await api.get('/reports/tasks', { params, signal })).data ?? null) as TasksReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError, refetch }
}
