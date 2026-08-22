/**
 * useVacanciesData — data layer for VacanciesPage: the customers (for the pickers),
 * the paginated + server-filtered vacancy list and the server-wide stats — all via
 * React Query (A-3: cached per filter/page, keepPreviousData). Returns setter wrappers
 * over the list cache so the container's optimistic bulk/drawer updates keep working.
 */
import { useCallback, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { pickStatsScopeParams } from '@/lib/statsScopeParams'
import { mapVacancy } from '../data/mapVacancy'
import type { Vacancy, ApiVacancy } from '@/types/vacancy'
import type { Id } from '@/types/common'

export interface VacancyCustomer { id: Id | undefined; name: string }
export type VacancyStats = Record<string, unknown>

// FE column-key ⇄ sort_by/sort_dir. Column sort (Danny's item 4, PLAN-VACATURES-
// SOLLICITATIES.md): a NEW, SEPARATE pair from the old `sort=status` param — that
// one stays whitelisted and unwired here on purpose (VacancyQuery::rules() keeps
// both accepted independently; never send both for the same click). Only the two
// columns the backend actually whitelists (`created_at`, `applications_count`)
// map here — an unmapped FE key (e.g. clicking Title) simply reorders the loaded
// page locally via DataTable's own sortedRows, exactly like the applications
// reference adoption (useApplicationsData.ts).
export const VACANCY_SORT_KEYS: Record<string, string> = {
  createdAt: 'created_at',
  applications: 'applications_count',
}

export interface VacancySort { by: string; dir: 'asc' | 'desc' }

// Translate the page's FE-column-keyed sort into sort_by/sort_dir request params —
// empty object (no keys added) for no sort or an unmapped column, so the request
// shape is unchanged either way and never 422s on an unwhitelisted sort_by.
export function vacancySortParams(sort?: VacancySort | null): Record<string, string> {
  const sortBy = sort ? VACANCY_SORT_KEYS[sort.by] : undefined
  return sortBy ? { sort_by: sortBy, sort_dir: sort!.dir } : {}
}

interface UseVacanciesDataArgs { filterParams: Record<string, unknown>; page: number; pageSize: number; t: TFunction; sort?: VacancySort | null }
interface UseVacanciesDataResult {
  vacancies: Vacancy[]
  setVacancies: Dispatch<SetStateAction<Vacancy[]>>
  loading: boolean
  error: string | null
  total: number
  setTotal: Dispatch<SetStateAction<number>>
  lastPage: number
  stats: VacancyStats | null
  customers: VacancyCustomer[]
  refresh: () => void
}
interface ListResult { vacancies: Vacancy[]; total: number; lastPage: number }

// Stable empty defaults — a fresh `?? []` each render loops the registerFilters effect
// (see useCandidatesData for the full note).
const EMPTY_VACANCIES: Vacancy[] = []
const EMPTY_CUSTOMERS: VacancyCustomer[] = []

// VacancyQuery::rules() caps per_page at `between:1,200` — measured 2026-08-05 (the
// "zet ik hem op 500, klapt deze eruit" bug: the page sent the tenant's raw
// default_per_page straight through with no clamp, so a 500 preference 422'd).
// Exported so VacanciesPage can clamp the pageSize picker to the SAME ceiling —
// one source of truth for both the table's page size and this defensive re-clamp.
export const VACANCIES_MAX_PER_PAGE = 500

export function useVacanciesData({ filterParams, page, pageSize, t, sort }: UseVacanciesDataArgs): UseVacanciesDataResult {
  const queryClient = useQueryClient()
  const sortQuery = vacancySortParams(sort)

  // Customers once, for the filters/drawer/modal/bulk pickers.
  const { data: customers = EMPTY_CUSTOMERS } = useQuery({
    queryKey: ['vacancies', 'customer-pickers'],
    queryFn: async ({ signal }): Promise<VacancyCustomer[]> => {
      // per_page 200 = the /customers server cap — without it the server default (25)
      // silently truncated the picker to the first 25 customers (fleet-verify 05-08).
      const res = await api.get('/customers', { signal, params: { per_page: 200 } })
      return unwrapList<{ id?: Id; name?: string; company_name?: string }>(res).rows.map(c => ({ id: c.id, name: c.name ?? c.company_name ?? '—' }))
    },
  })

  // List (paginated, server-filtered). 404 = endpoint not built → empty, not an error.
  // sort rides in the key too (DATATABLE-SORT-1 reference adoption) — a header
  // click that maps to a real sort_by cleanly refetches.
  const listQuery = useQuery({
    queryKey: ['vacancies', filterParams, page, pageSize, sort],
    queryFn: async ({ signal }): Promise<ListResult> => {
      try {
        // Defensive re-clamp (belt-and-braces): the page already clamps pageSize to
        // VACANCIES_MAX_PER_PAGE via useListPageSize, but this hook never trusts a
        // caller to have done it — a 422 here is expensive to diagnose (mirrors
        // useApplicationsData's identical guard).
        const res = await api.get('/vacancies', { params: { ...filterParams, ...sortQuery, page, per_page: Math.min(pageSize, VACANCIES_MAX_PER_PAGE) }, signal })
        const { rows, total, lastPage } = unwrapList<ApiVacancy>(res)
        return { vacancies: rows.map(mapVacancy), total, lastPage }
      } catch (err) {
        if ((err as { response?: { status?: number } })?.response?.status === 404) return { vacancies: [], total: 0, lastPage: 1 }
        throw err
      }
    },
    placeholderData: keepPreviousData,
  })

  const vacancies = listQuery.data?.vacancies ?? EMPTY_VACANCIES
  const total     = listQuery.data?.total ?? 0
  const lastPage  = listQuery.data?.lastPage ?? 1
  const loading   = listQuery.isLoading
  const error     = listQuery.isError ? t('page.loadError') : null

  // Stats — real SERVER-WIDE totals (§3B), narrowed only by the VIEW-SCOPE subset
  // of filterParams (STATS-SCOPE-1: include_archived, see pickStatsScopeParams) —
  // never by a dimension/attention filter (status/owner_id/customer_id/category/
  // agent_id/published/closing_soon/…, measured 2026-08-22: the full filterParams
  // was reaching this request, collapsing the KPI row to the filtered subset).
  const statsParams = useMemo(() => pickStatsScopeParams(filterParams), [filterParams])
  const { data: stats = null } = useQuery({
    queryKey: ['vacancies', 'stats', statsParams],
    queryFn: async ({ signal }): Promise<VacancyStats | null> => {
      const res = await api.get('/vacancies/stats', { params: statsParams, signal })
      return (unwrap(res) ?? null) as VacancyStats | null
    },
  })

  // Setter wrappers over the list cache — keep the container's optimistic mutations working.
  const setVacancies = useCallback<Dispatch<SetStateAction<Vacancy[]>>>(updater => {
    queryClient.setQueryData<ListResult>(['vacancies', filterParams, page, pageSize, sort], prev => {
      const cur = prev ?? { vacancies: [], total: 0, lastPage: 1 }
      return { ...cur, vacancies: typeof updater === 'function' ? (updater as (p: Vacancy[]) => Vacancy[])(cur.vacancies) : updater }
    })
  }, [queryClient, filterParams, page, pageSize, sort])

  const setTotal = useCallback<Dispatch<SetStateAction<number>>>(updater => {
    queryClient.setQueryData<ListResult>(['vacancies', filterParams, page, pageSize, sort], prev => {
      const cur = prev ?? { vacancies: [], total: 0, lastPage: 1 }
      return { ...cur, total: typeof updater === 'function' ? (updater as (p: number) => number)(cur.total) : updater }
    })
  }, [queryClient, filterParams, page, pageSize, sort])

  // EXCEL-VACATURES-1: a side-channel write (the create-modal's file import) has no
  // single record to prepend optimistically like handleCreated does — it can create
  // any number of vacancies in one run — so the honest refresh is a real refetch of
  // both the list and the stats query (mirrors useCustomersData's own refresh).
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['vacancies'] })
  }, [queryClient])

  return { vacancies, setVacancies, loading, error, total, setTotal, lastPage, stats, customers, refresh }
}
