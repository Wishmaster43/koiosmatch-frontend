/**
 * useCustomersData — the list data layer for CustomersPage (§3): the paginated,
 * server-filtered list + the server-wide stats, via React Query (A-3: cached per
 * filter/page, keepPreviousData). A missing endpoint (404) is an empty list, not an
 * error. Returns setter wrappers over the cache so optimistic updates keep working.
 */
import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
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

export function useCustomersData({ filterParams, page, pageSize, t }: Args) {
  const queryClient = useQueryClient()

  // List (paginated, server-filtered). 404 = endpoint not built → empty, not an error.
  const listQuery = useQuery({
    queryKey: ['customers', filterParams, page, pageSize],
    queryFn: async ({ signal }): Promise<ListResult> => {
      try {
        const res = await api.get('/customers', { params: { ...filterParams, page, per_page: pageSize }, signal })
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

  // Stats (server-wide totals, honour the filters).
  const { data: stats = null } = useQuery({
    queryKey: ['customers', 'stats', filterParams],
    queryFn: async ({ signal }): Promise<PageStats | null> => {
      const res = await api.get('/customers/stats', { params: filterParams, signal })
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

  return { customers, setCustomers, loading, error, total, setTotal, lastPage, stats }
}
