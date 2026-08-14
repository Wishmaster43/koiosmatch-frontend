/**
 * useContactsReport — data layer for ContactsReport: loads GET /reports/contacts
 * for the given period and exposes the four UI states. Via React Query: the
 * result is cached per period (revisiting a period is instant) and a stale
 * request cancels (A-3). Mirrors useTasksReport, including the sibling `period`
 * param contract (explicit from/to would win server-side; the hub only sends
 * presets).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ContactsReportData, ReportPeriod } from '@/types/analytics'

export function useContactsReport(period: ReportPeriod) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'contacts', period],
    queryFn: async ({ signal }) => ((await api.get('/reports/contacts', { params: { period }, signal })).data ?? null) as ContactsReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
