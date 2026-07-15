/**
 * useReportDrill — data layer for ReportDrillDrawer (§3): when a drill opens, loads
 * the underlying records (rowsEndpoint) + Koios AI advice (adviceEndpoint). Both
 * degrade gracefully (a missing endpoint just leaves an empty list / no advice). Via
 * React Query: each query stays disabled until its endpoint exists, caches per
 * drill target and cancels a superseded fetch (A-3).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { DrillSpec } from './ReportDrillDrawer'

type DrillRow = Record<string, unknown>

export function useReportDrill(drill: DrillSpec | null) {
  // Underlying records for the open drill (idle until a drill with a rows endpoint opens).
  const rowsQ = useQuery({
    queryKey: ['report-drill', 'rows', drill?.rowsEndpoint, drill?.rowsParams],
    enabled: !!drill?.rowsEndpoint,
    queryFn: async ({ signal }) => {
      if (!drill?.rowsEndpoint) return [] as DrillRow[]
      const r = await api.get(drill.rowsEndpoint, { params: drill.rowsParams, signal })
      return (unwrapList(r).rows) as DrillRow[]
    },
  })

  // Koios AI advice for the open drill (idle until a drill with an advice endpoint opens).
  const adviceQ = useQuery({
    queryKey: ['report-drill', 'advice', drill?.adviceEndpoint, drill?.adviceParams],
    enabled: !!drill?.adviceEndpoint,
    queryFn: async ({ signal }) => {
      if (!drill?.adviceEndpoint) return null
      const r = await api.get(drill.adviceEndpoint, { params: drill.adviceParams, signal })
      return (r.data?.advice ?? r.data?.data?.advice ?? (typeof r.data === 'string' ? r.data : null)) as string | null
    },
  })

  return {
    rows:          rowsQ.data ?? [],
    rowsLoading:   rowsQ.isLoading,
    advice:        adviceQ.data ?? null,
    adviceLoading: adviceQ.isLoading,
  }
}
