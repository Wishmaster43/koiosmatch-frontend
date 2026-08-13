/**
 * useReportDrill — data layer for ReportDrillDrawer (§3): when a drill opens, loads
 * the underlying records (rowsEndpoint) + Koios AI advice (adviceEndpoint). Rows use
 * the house envelope `{ data: [...], meta: { total } }` (REPORTS-DRILL-1) — `total`
 * lets the drawer show "50 of {total}" when the server capped the list. Both queries
 * degrade gracefully (a missing endpoint just leaves an empty list / no advice); rows
 * additionally degrade on a 403 (per-segment data permission the report itself didn't
 * need) — that is a calm "rows hidden" state, not an error banner. Via React Query:
 * each query stays disabled until its endpoint exists, caches per drill target and
 * cancels a superseded fetch (A-3).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { DrillSpec } from './ReportDrillDrawer'

type DrillRow = Record<string, unknown>

// True for an axios 403 — the segment's own data permission was denied while the
// report itself rendered fine (aggregate-clearance vs. identified-record-clearance).
function isForbidden(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 403
}

export function useReportDrill(drill: DrillSpec | null) {
  // Underlying records for the open drill (idle until a drill with a rows endpoint opens).
  const rowsQ = useQuery({
    queryKey: ['report-drill', 'rows', drill?.rowsEndpoint, drill?.rowsParams],
    enabled: !!drill?.rowsEndpoint,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!drill?.rowsEndpoint) return { rows: [] as DrillRow[], total: 0 }
      const r = await api.get(drill.rowsEndpoint, { params: drill.rowsParams, signal })
      const { rows, total } = unwrapList(r)
      return { rows: rows as DrillRow[], total }
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
    rows:          rowsQ.data?.rows ?? [],
    rowsTotal:     rowsQ.data?.total ?? 0,
    rowsLoading:   rowsQ.isLoading,
    rowsForbidden: isForbidden(rowsQ.error),
    advice:        adviceQ.data ?? null,
    adviceLoading: adviceQ.isLoading,
  }
}
