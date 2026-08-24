/**
 * useCandidatesKpiSuite — the real nine-KPI suite behind the candidates report
 * strip (GET /reports/candidates/kpis → {data: [{key,label,count}]}, measured:
 * ReportController::candidateKpis validates period/from/to + the shared panel
 * filters, so the suite narrows exactly like the report envelope). The server
 * label is deliberately ignored (§5: labels come from i18n); a card the server
 * honestly omitted (STATS-HONEST-1, e.g. no_cv without an is_cv document type)
 * simply has no entry — the strip renders the house dash for it.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import type { ReportPeriod } from '@/types/analytics'

interface SuiteCard { key: string; label?: string; count: number | null }

export function useCandidatesKpiSuite(period: ReportPeriod, filters: ReportFilterState, enabled: boolean) {
  const params = buildReportQueryParams(period, 'candidates', filters)
  const query = useQuery({
    queryKey: ['report', 'candidates', 'kpi-suite', params],
    enabled,
    queryFn: async ({ signal }) => {
      const r = await api.get('/reports/candidates/kpis', { params, signal })
      // Envelope: {data: [...]} — tolerant of a bare array (same read as unwrap).
      const cards = (r.data?.data ?? r.data ?? []) as SuiteCard[]
      return Array.isArray(cards) ? cards : []
    },
  })
  // A Map keyed on the server key; error/loading read as "no entries" → dashes.
  return new Map((query.data ?? []).map(c => [c.key, c.count]))
}
