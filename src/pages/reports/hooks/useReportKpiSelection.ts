/**
 * useReportKpiSelection — fetch KPI selection from the API, with fallback to catalog default.
 * Reads GET /reports/kpi-selection/{scope}, defaulting to catalog.default on 404.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { getReportKpiDefaultOrder, type ReportKpiScopeId } from '../kpiCatalog'

interface KpiSelectionResponse {
  data: string[]
}

export function useReportKpiSelection(scopeId: ReportKpiScopeId) {
  const defaultOrder = getReportKpiDefaultOrder(scopeId)

  return useQuery({
    queryKey: ['reports', 'kpi-selection', scopeId],
    queryFn: async () => {
      try {
        const { data } = await api.get<KpiSelectionResponse>(`/reports/kpi-selection/${scopeId}`)
        return data.data
      } catch (err: unknown) {
        // 404 or other error — return default, not throw
        const axErr = err as { response?: { status?: number } }
        if (axErr.response?.status === 404) {
          return defaultOrder
        }
        throw err
      }
    },
    staleTime: 60 * 1000, // 60 seconds
    retry: 1,
  })
}
