/**
 * useCandidatesData — data layer for CandidatesPage: the paginated + server-filtered
 * candidate list, the server-wide stats (totals across the whole filtered set) and the
 * location filter options — all via React Query (A-3: cached per filter/page, dedup,
 * keepPreviousData so paging doesn't flash). Returns setter wrappers over the query cache
 * so the container's optimistic bulk/drawer updates keep mutating the list directly.
 */
import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { heavyGet } from '@/lib/heavyGet'
import { mapCandidate } from '../data/mapCandidate'
import type { ApiCandidate, Candidate, CandidateStats } from '@/types/candidate'
import type { Id } from '@/types/common'

interface ActionMsg { type: string; text: string }
interface LocationOption { id?: Id; name?: string }
interface ListResult { candidates: Candidate[]; total: number; lastPage: number }

interface UseCandidatesDataParams {
  filterParams: Record<string, unknown>
  page: number
  pageSize: number
  t: TFunction
  setActionMsg: (msg: ActionMsg) => void
}

// Stable empty defaults. A fresh `?? []` each render gives the memo chain (options →
// filterGroups) a new identity, which re-registers the filter groups every render and
// loops setState in RightPanelContext ("Maximum update depth exceeded"). Module-level
// constants keep the reference stable while a query is loading/errored.
const EMPTY_CANDIDATES: Candidate[] = []
const EMPTY_LOCATIONS: LocationOption[] = []

export function useCandidatesData({ filterParams, page, pageSize, t, setActionMsg }: UseCandidatesDataParams) {
  const queryClient = useQueryClient()

  // List (paginated, server-filtered). 422 = the backend rejected a filter value → keep the
  // page usable (empty + soft notice, filters stay visible), never a hard failure.
  const listQuery = useQuery({
    queryKey: ['candidates', filterParams, page, pageSize],
    queryFn: async ({ signal }): Promise<ListResult> => {
      try {
        const res = await api.get('/candidates', { params: { ...filterParams, page, per_page: pageSize }, signal })
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

  // Stats: real totals across the whole filtered set (not just the page); filter-only key.
  const statsQuery = useQuery({
    queryKey: ['candidates', 'stats', filterParams],
    queryFn: async ({ signal }): Promise<CandidateStats | null> => {
      const res = await heavyGet('/candidates/stats', { params: filterParams, signal })
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
  const setCandidates = useCallback<Dispatch<SetStateAction<Candidate[]>>>(updater => {
    queryClient.setQueryData<ListResult>(['candidates', filterParams, page, pageSize], prev => {
      const cur = prev ?? { candidates: [], total: 0, lastPage: 1 }
      return { ...cur, candidates: typeof updater === 'function' ? (updater as (p: Candidate[]) => Candidate[])(cur.candidates) : updater }
    })
  }, [queryClient, filterParams, page, pageSize])

  const setTotal = useCallback<Dispatch<SetStateAction<number>>>(updater => {
    queryClient.setQueryData<ListResult>(['candidates', filterParams, page, pageSize], prev => {
      const cur = prev ?? { candidates: [], total: 0, lastPage: 1 }
      return { ...cur, total: typeof updater === 'function' ? (updater as (p: number) => number)(cur.total) : updater }
    })
  }, [queryClient, filterParams, page, pageSize])

  return { candidates, setCandidates, loading, error, total, setTotal, lastPage, stats, statsFailed, locations }
}
