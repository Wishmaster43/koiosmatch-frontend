/**
 * useSmCandidateStats — server-side aggregates for the Shiftmanager candidates
 * charts/KPIs (PERF-1), replacing "fetch 500 rows just to count them" with one
 * GET /sm_candidates/stats call. The route shares ONE filter vocabulary with
 * GET /sm_candidates (search / status scalar or array / position / active /
 * ai_enabled; SM-STATS-3, BE 614813cce) so a filtered chart and a filtered list
 * can never disagree, plus a `top_cities`/`year` pair specific to this endpoint.
 * The BE validates the query: an unknown key answers 422, so cleanParams only
 * ever forwards the accepted keys. See SmCandidateController.php@stats and
 * Services/Shiftmanager/SmCandidateStatsBuilder.php (koiosmatch-api, read-only
 * reference) for the authoritative shape.
 *
 * Response shape (hand-typed: the generated OpenAPI spec documents the request
 * only, no 2xx schema yet — §10). Units, per SM-STATS-1's own doc comment:
 * `total`/`by_*[].total`/`login_recency.*`/`*_per_month[].total` are all plain
 * COUNTS (never a share-of-total percentage — EENHEID-LES); `by_*[].label` is a
 * distinct-value axis (categorical, "Onbekend" for null/blank). SM-STATS-3 adds
 * three count blocks over the whole (filtered) mirror: `activity` (buckets over
 * ACTIVE rows, mutually exclusive in the order never worked, worked this month,
 * planned from tomorrow on, idle), `attention` (the calcAttention rule) and `risk`
 * (no_shows: no_show_count above 0; ending_soon: end_date_employment within the
 * next 30 days). They are optional here so a payload without them still renders
 * through the row-derived fallbacks; `risk.cancellations` is not served (the
 * mirror has no cancellations column).
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

// One { label, total } row of a categorical breakdown (by_status/by_position/…).
export interface SmCandidateStatBucket {
  label: string
  total: number
}

// One { month, total } row of a twelve-month series (registrations/departures per month).
export interface SmCandidateMonthBucket {
  month: number
  total: number
}

export interface SmCandidateStats {
  total: number
  by_status: SmCandidateStatBucket[]
  by_position: SmCandidateStatBucket[]
  by_city: SmCandidateStatBucket[]
  by_type_of_employee: SmCandidateStatBucket[]
  login_recency: {
    last_30_days: number
    last_90_days: number
    older: number
    never: number
  }
  registrations_per_month: SmCandidateMonthBucket[]
  departures_per_month: SmCandidateMonthBucket[]
  activity?: SmCandidateActivity
  attention?: { count: number }
  risk?: { no_shows: number; ending_soon: number }
}

// Mutually exclusive activity buckets over ACTIVE candidates, plus the inactive headcount (plain COUNTS).
export interface SmCandidateActivity {
  active: number
  inactive: number
  never_worked: number
  worked_this_month: number
  planned: number
  idle: number
}

// The shared /sm_candidates filter vocabulary (SmCandidateFilterRequest: status as a scalar or
// an array, position exact) plus the two params unique to the stats route.
export interface SmCandidateStatsParams {
  search?: string
  status?: string | string[]
  position?: string
  active?: boolean
  ai_enabled?: boolean
  top_cities?: number
  year?: number
}

// Strips undefined so an unset filter never becomes a literal "undefined" query param,
// and forwards only the keys the BE accepts (an unknown key answers 422 since SM-STATS-3).
function cleanParams(params: SmCandidateStatsParams): Record<string, string | string[] | number | boolean> {
  const out: Record<string, string | string[] | number | boolean> = {}
  if (params.search !== undefined)     out.search = params.search
  if (params.status !== undefined)     out.status = params.status
  if (params.position !== undefined)   out.position = params.position
  if (params.active !== undefined)     out.active = params.active
  if (params.ai_enabled !== undefined) out.ai_enabled = params.ai_enabled
  if (params.top_cities !== undefined) out.top_cities = params.top_cities
  if (params.year !== undefined)       out.year = params.year
  return out
}

// React Query wrapper around GET /sm_candidates/stats — dedups/caches per param set,
// auto-cancels on unmount/param change. Pass {} for the tenant-wide unfiltered totals.
export function useSmCandidateStats(params: SmCandidateStatsParams = {}) {
  const query = useQuery({
    queryKey: ['sm_candidates', 'stats', params],
    queryFn: async ({ signal }) => {
      const res = await api.get('/sm_candidates/stats', { params: cleanParams(params), signal })
      return res.data as SmCandidateStats
    },
  })

  return {
    stats:   query.data ?? null,
    loading: query.isLoading,
    error:   query.isError,
  }
}
