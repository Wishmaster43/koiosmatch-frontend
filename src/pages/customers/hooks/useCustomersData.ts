/**
 * useCustomersData — the list data layer for CustomersPage (§3): the paginated,
 * server-filtered list + the server-wide stats, via React Query (A-3: cached per
 * filter/page, keepPreviousData). A missing endpoint (404) is an empty list, not an
 * error. Returns setter wrappers over the cache so optimistic updates keep working.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { pickStatsScopeParams } from '@/lib/statsScopeParams'
import { mapCustomer } from '../data/mapCustomer'
import type { Customer, ApiCustomer } from '@/types/customer'
import type { Id } from '@/types/common'

export interface PageStats {
  by_status?: Array<{ value?: string; status?: string; count?: number }>
  by_owner?: Array<{ id?: Id; owner_id?: Id; name?: string; count?: number }>
  locations?: number; departments?: number; contacts?: number
  open_vacancies?: number; active_matches?: number; without_contact?: number
}

interface Args { filterParams: Record<string, unknown>; page: number; pageSize: number; t: TFunction }
interface ListResult { customers: Customer[]; total: number; lastPage: number }

// Stable empty default — a fresh `?? []` each render loops the registerFilters effect
// (see useCandidatesData for the full note).
const EMPTY_CUSTOMERS: Customer[] = []

// CustomerController::index caps per_page at `between:1,200` — measured 2026-08-05
// (Danny: "op 500 zetten geeft 'Klanten laden is mislukt'", reproduced as a real
// 422; per_page=200 succeeds). Exported so CustomersPage can clamp the pageSize
// picker to the SAME ceiling — mirrors useApplicationsData/useVacanciesData's
// identical constant + defensive re-clamp below.
export const CUSTOMERS_MAX_PER_PAGE = 500

export function useCustomersData({ filterParams, page, pageSize, t }: Args) {
  const queryClient = useQueryClient()

  // List (paginated, server-filtered). 404 = endpoint not built → empty, not an error.
  const listQuery = useQuery({
    queryKey: ['customers', filterParams, page, pageSize],
    queryFn: async ({ signal }): Promise<ListResult> => {
      try {
        // Defensive re-clamp (belt-and-braces): the page already clamps pageSize to
        // CUSTOMERS_MAX_PER_PAGE via useListPageSize, but this hook never trusts a
        // caller to have done it — a 422 here is expensive to diagnose (mirrors
        // useApplicationsData/useVacanciesData's identical guard).
        const res = await api.get('/customers', { params: { ...filterParams, page, per_page: Math.min(pageSize, CUSTOMERS_MAX_PER_PAGE) }, signal })
        const { rows, total, lastPage } = unwrapList<ApiCustomer>(res)
        return { customers: rows.map(mapCustomer), total, lastPage }
      } catch (err) {
        if ((err as { response?: { status?: number } })?.response?.status === 404) return { customers: [], total: 0, lastPage: 1 }
        throw err
      }
    },
    placeholderData: keepPreviousData,
  })

  const customers = listQuery.data?.customers ?? EMPTY_CUSTOMERS
  const total     = listQuery.data?.total ?? 0
  const lastPage  = listQuery.data?.lastPage ?? 1
  const loading   = listQuery.isLoading
  const error     = listQuery.isError ? t('page.loadError') : null

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
    const sig = (listQuery.data?.customers ?? []).map(r => String(r.id)).join('|')
    if (lastRowIdsRef.current !== null && sig !== lastRowIdsRef.current) setRowsEpoch(e => e + 1)
    lastRowIdsRef.current = sig
  }, [listQuery.isFetching, listQuery.data])

  // Stats — real SERVER-WIDE totals (§3B), narrowed only by the VIEW-SCOPE subset
  // of filterParams (STATS-SCOPE-1: include_archived, see pickStatsScopeParams) —
  // never by a dimension filter (status/phase/owner_id/city/state/industry/…,
  // measured 2026-08-22: the full filterParams was reaching this request,
  // collapsing the KPI row to the filtered subset).
  const statsParams = useMemo(() => pickStatsScopeParams(filterParams), [filterParams])
  const { data: stats = null } = useQuery({
    queryKey: ['customers', 'stats', statsParams],
    queryFn: async ({ signal }): Promise<PageStats | null> => {
      const res = await api.get('/customers/stats', { params: statsParams, signal })
      return (unwrap(res) ?? null) as PageStats | null
    },
  })

  // Setter wrappers over the list cache — keep the container's optimistic mutations working.
  const setCustomers = useCallback<Dispatch<SetStateAction<Customer[]>>>(updater => {
    queryClient.setQueryData<ListResult>(['customers', filterParams, page, pageSize], prev => {
      const cur = prev ?? { customers: [], total: 0, lastPage: 1 }
      return { ...cur, customers: typeof updater === 'function' ? (updater as (p: Customer[]) => Customer[])(cur.customers) : updater }
    })
  }, [queryClient, filterParams, page, pageSize])

  const setTotal = useCallback<Dispatch<SetStateAction<number>>>(updater => {
    queryClient.setQueryData<ListResult>(['customers', filterParams, page, pageSize], prev => {
      const cur = prev ?? { customers: [], total: 0, lastPage: 1 }
      return { ...cur, total: typeof updater === 'function' ? (updater as (p: number) => number)(cur.total) : updater }
    })
  }, [queryClient, filterParams, page, pageSize])

  // CUSTOMER-IMPORT-1: a side-channel write (the create-modal's file import) has no
  // single record to prepend optimistically like handleCreate does — it can create
  // any number of customers/locations/departments/contacts in one run — so the
  // honest refresh is a real refetch of both the list and the stats query.
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['customers'] })
  }, [queryClient])

  return { customers, setCustomers, loading, error, total, setTotal, lastPage, stats, refresh, rowsEpoch, fetching: listQuery.isFetching }
}
