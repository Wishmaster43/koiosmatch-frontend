/**
 * useCustomersData — the list data layer for CustomersPage (§3): the paginated,
 * server-filtered list + the server-wide stats, via React Query (A-3: cached per
 * filter/page, keepPreviousData). A missing endpoint (404) is an empty list, not an
 * error. Returns setter wrappers over the cache so optimistic updates keep working.
 */
// DRY: this import block and the listQuery-derived state extraction further down
// read as a clone of useVacanciesData (jscpd weak-mode match) — every entity list
// hook (candidates/customers/vacancies/applications) follows the SAME React Query
// shape by design (§3 blueprint); the setter duplication is already gone via
// useListFieldSetter, and further merging the query itself would require a single
// generic hook parameterised over four different list/stats endpoints and row
// shapes — a bigger abstraction than this repeated 7-line block justifies.
import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { pickListRange } from '@/lib/listRange'
import { pickStatsScopeParams } from '@/lib/statsScopeParams'
import { useRowsEpoch } from '@/hooks/useRowsEpoch'
import { useListFieldSetter } from '@/hooks/useListFieldSetter'
import { mapCustomer } from '../data/mapCustomer'
import type { Customer, ApiCustomer } from '@/types/customer'
import type { Id } from '@/types/common'

// TOTALS-NESTING-1 (measured 17-09): the counts sit under `totals`, never
// top-level (see customerInsightsConfig.ts's docblock for the read-side fix).
export interface PageStats {
  by_status?: Array<{ value?: string; status?: string; count?: number }>
  by_owner?: Array<{ id?: Id; owner_id?: Id; name?: string; count?: number }>
  totals?: {
    locations?: number; departments?: number; contacts?: number
    open_vacancies?: number; active_matches?: number; without_contact?: number
    open_opportunities?: number
  }
}

interface Args { filterParams: Record<string, unknown>; page: number; pageSize: number; t: TFunction }
interface ListResult { customers: Customer[]; total: number; lastPage: number; rangeFrom?: number | null; rangeTo?: number | null }

// Stable empty default — a fresh `?? []` each render loops the registerFilters effect
// (see useCandidatesData for the full note).
const EMPTY_CUSTOMERS: Customer[] = []

// The BE silently clamps per_page via PageSize::from(request, 25, 100) although the
// validation rule says between:1,500. Exported so CustomersPage clamps the pageSize
// picker to the SAME effective ceiling (50/100 offered, honestly).
export const CUSTOMERS_MAX_PER_PAGE = 100

// Composes the customers list/stats React Query data layer for the page (list, filters, pagination and the bulk-selection epoch below).
export function useCustomersData({ filterParams, page, pageSize, t }: Args) {
  const queryClient = useQueryClient()
  const listKey = ['customers', filterParams, page, pageSize]

  // List (paginated, server-filtered). 404 = endpoint not built → empty, not an error.
  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: async ({ signal }): Promise<ListResult> => {
      try {
        // Defensive re-clamp (belt-and-braces): the page already clamps pageSize to
        // CUSTOMERS_MAX_PER_PAGE via useListPageSize, but this hook never trusts a
        // caller to have done it — a 422 here is expensive to diagnose (mirrors
        // useApplicationsData/useVacanciesData's identical guard).
        const res = await api.get('/customers', { params: { ...filterParams, page, per_page: Math.min(pageSize, CUSTOMERS_MAX_PER_PAGE) }, signal })
        const { rows, total, lastPage, from, to } = unwrapList<ApiCustomer>(res)
        return { customers: rows.map(mapCustomer), total, lastPage, rangeFrom: from, rangeTo: to }
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
  // Server-reported row range for the footer (null until the BE meta carries it).
  const { rangeFrom, rangeTo } = pickListRange(listQuery.data)
  const error     = listQuery.isError ? t('page.loadError') : null

  // SELECT-RACE-1 (REFRESH-FIX-2): bump epoch only when settled row-id set changes.
  const rowsEpoch = useRowsEpoch(listQuery.isFetching, listQuery.data?.customers)

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
  const setCustomers = useListFieldSetter<ListResult, 'customers'>(listKey, 'customers', { customers: [], total: 0, lastPage: 1 })
  const setTotal = useListFieldSetter<ListResult, 'total'>(listKey, 'total', { customers: [], total: 0, lastPage: 1 })

  // CUSTOMER-IMPORT-1: a side-channel write (the create-modal's file import) has no
  // single record to prepend optimistically like handleCreate does — it can create
  // any number of customers/locations/departments/contacts in one run — so the
  // honest refresh is a real refetch of both the list and the stats query.
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['customers'] })
  }, [queryClient])

  return { customers, setCustomers, loading, error, total, setTotal, lastPage, rangeFrom, rangeTo, stats, refresh, rowsEpoch, fetching: listQuery.isFetching }
}
