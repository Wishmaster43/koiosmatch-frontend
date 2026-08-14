/**
 * useReportCompare (RAPPORT-COMPARE-1 adoption) — data layer for
 * GET /reports/{slug}/compare. One hook, reused by every report the backend has
 * wired (reportCompareSupport.ts is the single source of which slugs qualify).
 *
 * `from`/`to` are the report's OWN already-resolved current window (the value
 * the plain report endpoint returned in its envelope, e.g. `data.from`/`data.to`)
 * — never re-derived from the `period` preset client-side, so the compared
 * window is always byte-identical to what the report page is already showing.
 * `extraParams` carries the same slice/filter params the plain report call used
 * (RAPPORT-FILTERS-1) so both windows run under the identical filter set.
 *
 * Disabled (no request fired) whenever `slug` is null (unsupported report/view)
 * or `mode` is 'off' or an incomplete custom range — never a request with a
 * half-built compare param.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { CompareSlug } from './reportCompareSupport'
import { compareModeToParams, type ReportCompareMode } from './reportCompareMode'

// The generic shape ReportComparator::metric() emits for every diffed leaf.
export interface CompareMetric {
  current: number
  previous: number
  delta: number
  delta_pct: number | null
}

export interface ReportCompareEnvelope {
  report: string
  current: { from: string; to: string }
  previous: { from: string; to: string }
  // Every other key mirrors the plain report's own payload shape, each leaf
  // diffed into a CompareMetric (or, for distribution/timeseries rows, an array
  // of rows carrying their own per-field CompareMetric spread) — shape-agnostic
  // by design (see ReportComparator's own docblock), so this stays a loose bag.
  [key: string]: unknown
}

export function useReportCompare(
  slug: CompareSlug | null,
  from: string | undefined,
  to: string | undefined,
  mode: ReportCompareMode,
  extraParams: Record<string, unknown> = {},
) {
  const compareParams = compareModeToParams(mode)
  const enabled = !!slug && !!from && !!to && !!compareParams
  const params = { ...extraParams, from, to, ...compareParams }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', slug, 'compare', params],
    enabled,
    queryFn: async ({ signal }) =>
      ((await api.get(`/reports/${slug}/compare`, { params, signal })).data ?? null) as ReportCompareEnvelope | null,
  })

  return { data: enabled ? (data ?? null) : null, loading: enabled && isLoading, error: enabled && isError, refetch }
}
