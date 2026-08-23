/**
 * useCandidatesData — data layer for CandidatesPage: the paginated + server-filtered
 * candidate list, the server-wide stats (STATS-SCOPE-1: view-scope params only, see
 * pickStatsScopeParams — never the active dimension/attention filters) and the
 * location filter options — all via React Query (A-3: cached per filter/page, dedup,
 * keepPreviousData so paging doesn't flash). Returns setter wrappers over the query cache
 * so the container's optimistic bulk/drawer updates keep mutating the list directly.
 *
 * CAND-SORT-1 (DATATABLE-SORT-1 reference adoption, mirrors useApplicationsData):
 * accepts an optional `sort` (FE-column-keyed) and translates it to a real
 * `sort_by`/`sort_dir` request param on the LIST query only — stats stay sortless
 * (a KPI total has no meaningful order). See CANDIDATE_SORT_KEYS below for the
 * whitelist this maps into; an unmapped column reorders the loaded page locally
 * (DataTable's own sortedRows) without ever reaching the request.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { heavyGet } from '@/lib/heavyGet'
import { pickStatsScopeParams } from '@/lib/statsScopeParams'
import { mapCandidate } from '../data/mapCandidate'
import type { ApiCandidate, Candidate, CandidateStats } from '@/types/candidate'
import type { Id } from '@/types/common'

interface ActionMsg { type: string; text: string }
interface LocationOption { id?: Id; name?: string }
interface ListResult { candidates: Candidate[]; total: number; lastPage: number }

// CAND-SORT-1: the controlled-sort shape CandidatesTable exchanges with this hook —
// `by` is always the clicked column's own key (see DataTable's ControlledSort).
export interface CandidateSort {
  by: string
  dir: 'asc' | 'desc'
}

interface UseCandidatesDataParams {
  filterParams: Record<string, unknown>
  page: number
  pageSize: number
  t: TFunction
  setActionMsg: (msg: ActionMsg) => void
  sort?: CandidateSort | null
}

// Stable empty defaults. A fresh `?? []` each render gives the memo chain (options →
// filterGroups) a new identity, which re-registers the filter groups every render and
// loops setState in RightPanelContext ("Maximum update depth exceeded"). Module-level
// constants keep the reference stable while a query is loading/errored.
const EMPTY_CANDIDATES: Candidate[] = []
const EMPTY_LOCATIONS: LocationOption[] = []

// CandidateProfileController::index caps per_page at `between:1,500` — matches the
// shared PAGE_SIZE_OPTIONS ceiling, so no clamp is actually needed today. Exported
// anyway (mirrors useApplicationsData/useVacanciesData/useCustomersData) so
// CandidatesPage documents the real measured backend rule instead of re-deriving
// a magic 500 — one source of truth if either ceiling ever moves independently.
export const CANDIDATES_MAX_PER_PAGE = 500

// CAND-SORT-1: the FE column keys that map to a REAL backend sort_by value —
// mirrors CandidateQuery::rules()' whitelist (`sort_by` in:last_name,first_name,
// created_at,updated_at,last_contact_at), verified LIVE against the running API
// 2026-08-08 (opposite sort_dir on last_name/created_at/last_contact_at each
// returned a different first row; an unlisted sort_by 422s). `first_name` and
// `updated_at` have no dedicated table column today, so they stay unmapped here —
// exactly like useApplicationsData leaves `updated_at` unmapped (no FE column for
// it either). A clicked column absent from this map still reorders the loaded
// page locally (DataTable's own sortedRows) — it just never becomes a
// sort_by/sort_dir request param, so it can never 422 the whitelist.
export const CANDIDATE_SORT_KEYS: Record<string, string> = {
  name: 'last_name',
  created: 'created_at',
  lastContact: 'last_contact_at',
}

// Translate the page's FE-column-keyed sort into sort_by/sort_dir request params —
// an empty object (no keys added) when there is no sort, or the column has no
// backend mapping, so the request shape is unchanged either way.
function sortParams(sort?: CandidateSort | null): Record<string, string> {
  const sortBy = sort ? CANDIDATE_SORT_KEYS[sort.by] : undefined
  return sortBy ? { sort_by: sortBy, sort_dir: sort!.dir } : {}
}

export function useCandidatesData({ filterParams, page, pageSize, t, setActionMsg, sort }: UseCandidatesDataParams) {
  const queryClient = useQueryClient()

  // List (paginated, server-filtered). 422 = the backend rejected a filter value → keep the
  // page usable (empty + soft notice, filters stay visible), never a hard failure. CAND-SORT-1:
  // `sort` rides in the query key too, so a header click that maps to a real sort_by cleanly refetches.
  const listQuery = useQuery({
    queryKey: ['candidates', filterParams, page, pageSize, sort],
    queryFn: async ({ signal }): Promise<ListResult> => {
      try {
        const res = await api.get('/candidates', { params: { ...filterParams, ...sortParams(sort), page, per_page: pageSize }, signal })
        const { rows, total, lastPage } = unwrapList(res)
        return { candidates: (rows as ApiCandidate[]).map(mapCandidate), total, lastPage }
      } catch (err) {
        if ((err as { response?: { status?: number } })?.response?.status === 422) {
          setActionMsg({ type: 'error', text: t('page.filterUnsupported', { defaultValue: 'Dit filter wordt (nog) niet door de server ondersteund.' }) })
          return { candidates: [], total: 0, lastPage: 1 }
        }
        throw err
      }
    },
    placeholderData: keepPreviousData,
  })

  const candidates = listQuery.data?.candidates ?? EMPTY_CANDIDATES
  const total      = listQuery.data?.total ?? 0
  const lastPage   = listQuery.data?.lastPage ?? 1
  const loading    = listQuery.isLoading
  const error      = listQuery.isError ? t('page.loadError', { defaultValue: 'Kandidaten laden is mislukt.' }) : null

  // SELECT-RACE-1, content-aware (REFRESH-FIX-2, Opus F2 + B1): on every SETTLED
  // render (not mid-fetch — with placeholderData the in-flight render still shows
  // the previous rows) compare the row-id signature with the last settled one and
  // bump the epoch only when it differs. The first settled render merely SEEDS
  // the signature (nothing is selectable before rows land) — so a warm-cache
  // mount, a same-ids refetch (cache invalidation after a field edit, a window-
  // focus refetch) and a SAME-IDS local setQueryData write (a bulk field edit)
  // never wipe the bulk selection; a local write that changes the id set (rows
  // archived away, a created row prepended) and Danny's race (a filtered
  // response replacing the rows) do — rows that left the page cannot stay selected.
  const lastRowIdsRef = useRef<string | null>(null)
  const [rowsEpoch, setRowsEpoch] = useState(0)
  useEffect(() => {
    if (listQuery.isFetching) return
    const sig = (listQuery.data?.candidates ?? []).map(r => String(r.id)).join('|')
    if (lastRowIdsRef.current !== null && sig !== lastRowIdsRef.current) setRowsEpoch(e => e + 1)
    lastRowIdsRef.current = sig
  }, [listQuery.isFetching, listQuery.data])

  // Stats: real SERVER-WIDE totals (§3B) — a dimension/attention filter (status,
  // owner, search, intake_planned, …) must never narrow the KPI row, only the
  // list. Only the view-scope subset of filterParams (today: include_archived,
  // shared by the archived/trash quick views) rides into the stats request; see
  // pickStatsScopeParams. Keyed on statsParams, not filterParams, so a dimension
  // filter change never refetches stats (STATS-SCOPE-1, fixes the 2026-08-22 audit:
  // ?intake_planned=1 was collapsing every other attention count to 0).
  const statsParams = useMemo(() => pickStatsScopeParams(filterParams), [filterParams])
  const statsQuery = useQuery({
    queryKey: ['candidates', 'stats', statsParams],
    queryFn: async ({ signal }): Promise<CandidateStats | null> => {
      const res = await heavyGet('/candidates/stats', { params: statsParams, signal })
      return (unwrap(res) ?? null) as CandidateStats | null
    },
  })
  const stats = statsQuery.data ?? null
  // Surfaced so the page can label page-scope fallback counts as such (STATS-OOM-1:
  // demo2's stats 500'd and the donuts silently presented the loaded page as totals).
  const statsFailed = statsQuery.isError

  // Vestiging (location) filter options — best-effort, cached for the session.
  const { data: locations = EMPTY_LOCATIONS } = useQuery({
    queryKey: ['locations'],
    queryFn: async ({ signal }): Promise<LocationOption[]> => {
      const res = await api.get('/locations', { signal })
      return (unwrapList(res).rows) as LocationOption[]
    },
  })

  // Setter wrappers over the list cache — keep the container's optimistic mutations working.
  // CAND-SORT-1: `sort` joined the query key above, so it must match here too, or an
  // optimistic update would write into a cache entry the active query never reads from.
  const setCandidates = useCallback<Dispatch<SetStateAction<Candidate[]>>>(updater => {
    queryClient.setQueryData<ListResult>(['candidates', filterParams, page, pageSize, sort], prev => {
      const cur = prev ?? { candidates: [], total: 0, lastPage: 1 }
      return { ...cur, candidates: typeof updater === 'function' ? (updater as (p: Candidate[]) => Candidate[])(cur.candidates) : updater }
    })
  }, [queryClient, filterParams, page, pageSize, sort])

  const setTotal = useCallback<Dispatch<SetStateAction<number>>>(updater => {
    queryClient.setQueryData<ListResult>(['candidates', filterParams, page, pageSize, sort], prev => {
      const cur = prev ?? { candidates: [], total: 0, lastPage: 1 }
      return { ...cur, total: typeof updater === 'function' ? (updater as (p: number) => number)(cur.total) : updater }
    })
  }, [queryClient, filterParams, page, pageSize, sort])

  return {
    candidates, setCandidates, loading, error, total, setTotal, lastPage, stats, statsFailed, locations,
    // SELECT-RACE-1: rowsEpoch is the clear-selection trigger; fetching (isFetching,
    // not isLoading — a background refetch counts too) drives the header
    // checkbox's inert state while a new result is in flight.
    rowsEpoch, fetching: listQuery.isFetching,
  }
}
