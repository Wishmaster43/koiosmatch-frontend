/**
 * useApplicationsData — data layer for ApplicationsPage (F-6, mirrors
 * useCandidatesData). Two server queries, both via React Query (cached per
 * filter, deduped, keepPreviousData so paging doesn't flash):
 *   - `list`  — the TABLE'S page (page/per_page + bucket + every filter
 *     ApplicationQuery supports — see useApplicationFilters). Only fetched in
 *     table view.
 *   - `wide`  — the WHOLE (bucket-less) funnel capped at the backend's per_page
 *     ceiling (`APPLICATIONS_MAX_PER_PAGE`), NEVER gated by view: it feeds the
 *     board's columns, and is the FALLBACK sample for owner/source/avgScore/
 *     aiTasks whenever `/applications/stats` itself fails to load (see below).
 * Stats (`/applications/stats`) — W27 (verified 2026-08-07): the backend's
 * `ApplicationQuery::stats()` returns real server-wide `by_owner`/`by_source`/
 * `avg_score`/`attention` alongside `by_phase`/`by_bucket` (via the shared
 * `ownerDistribution()` helper) — this was a BE gap when the wide-sample
 * fallback was first built, it no longer is. `statsParams` is now the SAME
 * `filterParams` object the list/wide queries use (every filter except bucket
 * applies to stats too — phase_key is harmlessly ignored there, the backend's
 * own `scopeOnly` guard skips it so the KPI strip keeps showing the full
 * distribution to pick between). `statsFailed` (mirrors CandidatesPage) lets
 * the page fall back to the wide sample AND say so, instead of silently
 * presenting a partial count as the true total (STATS-OOM-1 pattern).
 */
import { useCallback, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import api, { unwrap, unwrapList } from '@/lib/api'
import { mapApplication } from '../data/mapApplication'
import type { ApiApplication, Application } from '@/types/application'
import type { LookupItem } from '@/context/LookupsContext'

// Exported so applicationInsights.ts (the pure builder layer) shares one shape
// instead of hand-maintaining a second copy of the same server contract.
export interface AppStats {
  by_phase?: Array<{ phase_key?: string; key?: string; value?: string; count?: number }>
  by_bucket?: Record<string, number>
  by_owner?: Array<{ owner_id?: string | null; name?: string; count?: number }>
  by_source?: Array<{ source?: string | null; count?: number }>
  avg_score?: number | null
  attention?: { new?: number; scored?: number; ai_tasks?: number }
}
interface ListResult { applications: Application[]; total: number; lastPage: number }
interface WideResult { applications: Application[]; total: number }

// DATATABLE-SORT-1 reference adoption: the FE-column-keyed sort DataTable's
// controlled-sort escape hatch exchanges with ApplicationsPage (see
// ApplicationsTable/ApplicationsPage). `by` is always a Column.key, never a
// backend field name — see sortParams() below for the translation.
export interface AppSort {
  by: string
  dir: 'asc' | 'desc'
}

interface UseApplicationsDataParams {
  // usePageMemory widens the page's 'table' | 'board' state to string — compared
  // with === below, so the wider type is harmless here.
  view: string
  filterParams: Record<string, unknown>
  bucketParam?: string
  page: number
  pageSize: number
  funnelTypes: LookupItem[]
  sort?: AppSort | null
}

// Stable empty defaults (module-level so a loading/errored query never hands the
// memo chain a fresh-identity array every render — see useCandidatesData's note).
const EMPTY_APPLICATIONS: Application[] = []
// ApplicationQuery::rules() caps per_page at `between:1,500` — corrected 2026-08-05:
// the backend raised this ceiling (it was `between:1,200` when first measured
// 2026-07-15, after a WIP request with per_page=500 422'd); the frontend constant
// had gone stale and kept clamping the tenant's 500 preference down to 200 for no
// reason. Re-verified against the current ApplicationQuery.php before changing this
// number — never adjust this constant without re-checking the live backend rule.
// Exported so ApplicationsPage can clamp the pageSize picker to the SAME ceiling —
// one source of truth for both the table's page size and the wide sample's cap. A
// tenant with more than 500 matching applications still loses cards off the board /
// precision on the four page-scope figures above; filed as a BE gap, not fixable
// from the frontend short of a dedicated unpaginated board endpoint.
export const APPLICATIONS_MAX_PER_PAGE = 500
const WIDE_MAX_ROWS = APPLICATIONS_MAX_PER_PAGE

// A 404 means the endpoint isn't live yet on this tenant → treat as an empty
// list, never a hard error (mirrors the pre-pagination fetch's behaviour).
const isMissingEndpoint = (err: unknown): boolean => (err as { response?: { status?: number } })?.response?.status === 404

// SOLL-SORT-1 reference adoption (DATATABLE-SORT-1): the FE column keys that map
// to a REAL backend sort_by value — mirrors ApplicationQuery::SORTS, the
// whitelist verified live against ApplicationQuery.php (koiosmatch-api,
// 2026-08-08). A clicked column absent here still reorders the loaded page
// locally (DataTable's own sortedRows, unaffected by this hook) — it simply
// never becomes a sort_by/sort_dir query param, so an unmapped column can never
// 422 the request. `stage_order` sorts by the tenant's configured funnel order,
// not a hardcoded stage list.
export const APPLICATION_SORT_KEYS: Record<string, string> = {
  candidate: 'candidate_last_name',
  created: 'created_at',
  score: 'match_score',
  phase: 'stage_order',
}

// Translate the page's FE-column-keyed sort into sort_by/sort_dir request
// params — an empty object (no keys added) when there is no sort, or the
// column has no backend mapping, so the request shape is unchanged either way.
function sortParams(sort?: AppSort | null): Record<string, string> {
  const sortBy = sort ? APPLICATION_SORT_KEYS[sort.by] : undefined
  return sortBy ? { sort_by: sortBy, sort_dir: sort!.dir } : {}
}

export function useApplicationsData({ view, filterParams, bucketParam, page, pageSize, funnelTypes, sort }: UseApplicationsDataParams) {
  const queryClient = useQueryClient()

  // TABLE — server-paginated; only active in table view. Memoized so the
  // setApplications/setTotal callbacks below don't re-create on every render
  // (react-hooks/exhaustive-deps — a fresh array identity each render would
  // otherwise churn their useCallback deps). DATATABLE-SORT-1: `sort` rides in the
  // key too, so a header click that maps to a real sort_by cleanly refetches.
  const listKey = useMemo(() => ['applications', 'list', filterParams, bucketParam, page, pageSize, sort] as const,
    [filterParams, bucketParam, page, pageSize, sort])
  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: async ({ signal }): Promise<ListResult> => {
      // Defensive re-clamp (belt-and-braces): the page already clamps pageSize to
      // APPLICATIONS_MAX_PER_PAGE, but a 422 here is expensive to diagnose (2026-07-15),
      // so this hook never trusts a caller to have done it.
      const params = { ...filterParams, ...(bucketParam ? { bucket: bucketParam } : {}), ...sortParams(sort),
        page, per_page: Math.min(pageSize, APPLICATIONS_MAX_PER_PAGE) }
      try {
        const res = await api.get('/applications', { params, signal })
        const { rows, total, lastPage } = unwrapList<ApiApplication>(res)
        return { applications: rows.map(a => mapApplication(a, funnelTypes)), total, lastPage }
      } catch (err) {
        if (isMissingEndpoint(err)) return { applications: [], total: 0, lastPage: 1 }
        throw err
      }
    },
    placeholderData: keepPreviousData,
    enabled: view === 'table',
  })

  // WIDE — the whole bucket-less funnel, capped (see WIDE_MAX_ROWS above). Always
  // enabled: the insights strip needs it even while the table view is active.
  // DATATABLE-SORT-1: threaded through too (task: "list + wide queries") — the
  // board/insights consumers of wideRows then see the same order as the table.
  const wideKey = useMemo(() => ['applications', 'wide', filterParams, sort] as const, [filterParams, sort])
  const wideQuery = useQuery({
    queryKey: wideKey,
    queryFn: async ({ signal }): Promise<WideResult> => {
      try {
        const res = await api.get('/applications', { params: { ...filterParams, ...sortParams(sort), per_page: WIDE_MAX_ROWS }, signal })
        const { rows, total } = unwrapList<ApiApplication>(res)
        return { applications: rows.map(a => mapApplication(a, funnelTypes)), total }
      } catch (err) {
        if (isMissingEndpoint(err)) return { applications: [], total: 0 }
        throw err
      }
    },
    placeholderData: keepPreviousData,
  })

  const applications = listQuery.data?.applications ?? EMPTY_APPLICATIONS
  const total    = listQuery.data?.total ?? 0
  const lastPage = listQuery.data?.lastPage ?? 1
  const loading  = view === 'table' && listQuery.isLoading
  const error    = view === 'table' && listQuery.isError

  const wideRows    = wideQuery.data?.applications ?? EMPTY_APPLICATIONS
  const wideTotal   = wideQuery.data?.total ?? 0
  const wideLoading = wideQuery.isLoading
  // F3 (audit R1): the board renders off wideRows — expose its own error flag so
  // a wide-sample fetch failure shows an honest message instead of silently
  // looking like zero applications in every funnel column.
  const wideError   = wideQuery.isError
  // Honest page-scope flag (STATS-OOM-1 pattern): whenever stats fails to load,
  // owner/source/avgScore/aiTasks fall back to wideRows — flag when that sample
  // is itself partial (see `statsFailed` below for the trigger condition).
  const wideIsPartial = wideTotal > wideRows.length

  // Stats — real server-wide by_phase/by_bucket/by_owner/by_source/avg_score/
  // attention (W27). Reuses `filterParams` as-is: `ApplicationQuery::stats()`
  // applies every filter EXCEPT bucket/phase_key (its own scopeOnly guard skips
  // those two selectors specifically, so the KPI strip keeps showing the full
  // distribution to pick between) — bucket never enters filterParams anyway
  // (kept separate as `bucketParam`, list-only), and phase_key validates fine
  // here but has no effect, so sending the same object as the list is safe.
  const statsQuery = useQuery({
    queryKey: ['applications', 'stats', filterParams],
    queryFn: async ({ signal }): Promise<AppStats | null> => {
      try {
        const res = await api.get('/applications/stats', { params: filterParams, signal })
        return (unwrap(res) ?? null) as AppStats | null
      } catch (err) {
        if (isMissingEndpoint(err)) return null
        throw err
      }
    },
  })
  const stats = statsQuery.data ?? null
  // Surfaced so the page can label a wideRows-fallback count as such (STATS-OOM-1:
  // never silently present a partial sample as the true server-wide total).
  const statsFailed = statsQuery.isError

  // Setter wrappers over the query caches — keep the container's optimistic
  // mutations working. Both caches are updated together so a view switch never
  // shows a stale (pre-mutation) row; each falls back to a no-op default shape.
  const setApplications = useCallback<Dispatch<SetStateAction<Application[]>>>(updater => {
    const apply = (rows: Application[]) => (typeof updater === 'function' ? (updater as (p: Application[]) => Application[])(rows) : updater)
    queryClient.setQueryData<ListResult>(listKey, prev => {
      const cur = prev ?? { applications: [], total: 0, lastPage: 1 }
      return { ...cur, applications: apply(cur.applications) }
    })
    queryClient.setQueryData<WideResult>(wideKey, prev => {
      const cur = prev ?? { applications: [], total: 0 }
      return { ...cur, applications: apply(cur.applications) }
    })
  }, [queryClient, listKey, wideKey])

  // Adjust the table's total (create/detach optimistic count changes).
  const setTotal = useCallback<Dispatch<SetStateAction<number>>>(updater => {
    queryClient.setQueryData<ListResult>(listKey, prev => {
      const cur = prev ?? { applications: [], total: 0, lastPage: 1 }
      return { ...cur, total: typeof updater === 'function' ? (updater as (p: number) => number)(cur.total) : updater }
    })
  }, [queryClient, listKey])

  return {
    applications, setApplications, loading, error, total, setTotal, lastPage,
    wideRows, wideLoading, wideError, wideIsPartial, stats, statsFailed,
  }
}
