/**
 * useSourcesReport — data layer for SourcesReport: loads GET /reports/sources.
 * Exposes the four UI states. Via React Query: cached (revisiting is instant) and a
 * stale request cancels (A-3). Unlike flow/recruiters/vacancies/matches this endpoint
 * has no `period` bucket — it windows on `from`/`to` (server default: last 3 months) —
 * so `period` is accepted only to keep the report's call signature uniform with its
 * siblings and is intentionally not sent.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { SourcesReportData, ReportPeriod } from '@/types/analytics'

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for call-signature parity with the other report hooks (see doc comment above)
export function useSourcesReport(_period: ReportPeriod) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'sources'],
    queryFn: async ({ signal }) => ((await api.get('/reports/sources', { signal })).data ?? null) as SourcesReportData | null,
  })
  return { data: data ?? null, loading: isLoading, error: isError }
}
