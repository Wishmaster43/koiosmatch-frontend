/**
 * useApplicationsData — data layer for ApplicationsPage (F-6, mirrors
 * useCandidatesData). Two server queries, both via React Query (cached per
 * filter, deduped, keepPreviousData so paging doesn't flash):
 *   - `list`  — the TABLE'S page (page/per_page + bucket + the single-value
 *     filters ApplicationQuery supports: phase_key/vacancy_id/search/
 *     include_archived). Only fetched in table view.
 *   - `wide`  — the WHOLE (bucket-less) funnel capped at the backend's per_page
 *     ceiling (200, `ApplicationQuery::rules()`), NEVER gated by view: it feeds
 *     the board's columns AND the owner/source donuts + avgScore/aiTasks KPIs,
 *     which have no server-aggregate equivalent (BE gap — ApplicationQuery's
 *     stats() only returns by_phase/by_bucket, unlike CandidateQuery's
 *     by_owner/sources/attention). `wideTotal > wideRows.length` means those
 *     four figures are a >200-row sample, not the true total — the page shows
 *     an honest notice in that case (mirrors CandidatesPage's statsFailed notice).
 * Stats (`/applications/stats`) stay separate: real server-wide by_phase/
 * by_bucket, scoped by vacancy_id/search only (never bucket/phase_key — the
 * backend deliberately keeps the KPI strip showing the full distribution).
 */
import { useCallback, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import { mapApplication } from '../data/mapApplication'
import type { ApiApplication, Application } from '@/types/application'
import type { LookupItem } from '@/context/LookupsContext'

interface AppStats { by_phase?: Array<{ phase_key?: string; key?: string; value?: string; count?: number }>; by_bucket?: Record<string, number> }
interface ListResult { applications: Application[]; total: number; lastPage: number }
interface WideResult { applications: Application[]; total: number }

interface UseApplicationsDataParams {
  // usePageMemory widens the page's 'table' | 'board' state to string — compared
  // with === below, so the wider type is harmless here.
  view: string
  filterParams: Record<string, unknown>
  bucketParam?: string
  page: number
  pageSize: number
  funnelTypes: LookupItem[]
}

// Stable empty defaults (module-level so a loading/errored query never hands the
// memo chain a fresh-identity array every render — see useCandidatesData's note).
const EMPTY_APPLICATIONS: Application[] = []
// ApplicationQuery::rules() caps per_page at `between:1,200` — measured 2026-07-15
// after a WIP request with per_page=500 (the user's `default_per_page` profile
// setting, uncapped for other entities) 422'd. Exported so ApplicationsPage can
// clamp the pageSize picker to the SAME ceiling — one source of truth for both
// the table's page size and the wide sample's cap. A tenant with more than 200
// matching applications loses cards off the board / precision on the four
// page-scope figures above. A dedicated unpaginated board endpoint (or raising
// the cap) would remove this; filed as a BE gap, not fixable from the frontend.
export const APPLICATIONS_MAX_PER_PAGE = 200
const WIDE_MAX_ROWS = APPLICATIONS_MAX_PER_PAGE

// A 404 means the endpoint isn't live yet on this tenant → treat as an empty
// list, never a hard error (mirrors the pre-pagination fetch's behaviour).
const isMissingEndpoint = (err: unknown): boolean => (err as { response?: { status?: number } })?.response?.status === 404

export function useApplicationsData({ view, filterParams, bucketParam, page, pageSize, funnelTypes }: UseApplicationsDataParams) {
  const queryClient = useQueryClient()

  // TABLE — server-paginated; only active in table view. Memoized so the
  // setApplications/setTotal callbacks below don't re-create on every render
  // (react-hooks/exhaustive-deps — a fresh array identity each render would
  // otherwise churn their useCallback deps).
  const listKey = useMemo(() => ['applications', 'list', filterParams, bucketParam, page, pageSize] as const,
    [filterParams, bucketParam, page, pageSize])
  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: async ({ signal }): Promise<ListResult> => {
      // Defensive re-clamp (belt-and-braces): the page already clamps pageSize to
      // APPLICATIONS_MAX_PER_PAGE, but a 422 here is expensive to diagnose (2026-07-15),
      // so this hook never trusts a caller to have done it.
      const params = { ...filterParams, ...(bucketParam ? { bucket: bucketParam } : {}), page, per_page: Math.min(pageSize, APPLICATIONS_MAX_PER_PAGE) }
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
  const wideKey = useMemo(() => ['applications', 'wide', filterParams] as const, [filterParams])
  const wideQuery = useQuery({
    queryKey: wideKey,
    queryFn: async ({ signal }): Promise<WideResult> => {
      try {
        const res = await api.get('/applications', { params: { ...filterParams, per_page: WIDE_MAX_ROWS }, signal })
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
  // Honest page-scope flag (STATS-OOM-1 pattern): the owner/source donuts and the
  // avgScore/aiTasks KPIs derive from wideRows — flag when that sample is partial.
  const wideIsPartial = wideTotal > wideRows.length

  // Stats — real server-wide by_phase/by_bucket; scoped by vacancy_id/search only
  // (the backend ignores bucket/phase_key here on purpose).
  const statsParams = { vacancy_id: filterParams.vacancy_id, search: filterParams.search }
  const statsQuery = useQuery({
    queryKey: ['applications', 'stats', statsParams],
    queryFn: async ({ signal }): Promise<AppStats | null> => {
      try {
        const res = await api.get('/applications/stats', { params: statsParams, signal })
        return (res.data?.data ?? res.data ?? null) as AppStats | null
      } catch (err) {
        if (isMissingEndpoint(err)) return null
        throw err
      }
    },
  })
  const stats = statsQuery.data ?? null

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
    wideRows, wideLoading, wideIsPartial, stats,
  }
}
