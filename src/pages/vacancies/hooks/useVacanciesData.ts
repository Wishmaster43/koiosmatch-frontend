/**
 * useVacanciesData — data layer for VacanciesPage: the customers (for the pickers),
 * the paginated + server-filtered vacancy list and the server-wide stats — all via
 * React Query (A-3: cached per filter/page, keepPreviousData). Returns setter wrappers
 * over the list cache so the container's optimistic bulk/drawer updates keep working.
 */
import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import api, { unwrapList } from '@/lib/api'
import { mapVacancy } from '../data/mapVacancy'
import type { Vacancy, ApiVacancy } from '@/types/vacancy'
import type { Id } from '@/types/common'

export interface VacancyCustomer { id: Id | undefined; name: string }
export type VacancyStats = Record<string, unknown>

interface UseVacanciesDataArgs { filterParams: Record<string, unknown>; page: number; pageSize: number; t: TFunction }
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
}
interface ListResult { vacancies: Vacancy[]; total: number; lastPage: number }

export function useVacanciesData({ filterParams, page, pageSize, t }: UseVacanciesDataArgs): UseVacanciesDataResult {
  const queryClient = useQueryClient()

  // Customers once, for the filters/drawer/modal/bulk pickers.
  const { data: customers = [] } = useQuery({
    queryKey: ['vacancies', 'customer-pickers'],
    queryFn: async ({ signal }): Promise<VacancyCustomer[]> => {
      const res = await api.get('/customers', { signal })
      return unwrapList<{ id?: Id; name?: string; company_name?: string }>(res).rows.map(c => ({ id: c.id, name: c.name ?? c.company_name ?? '—' }))
    },
  })

  // List (paginated, server-filtered). 404 = endpoint not built → empty, not an error.
  const listQuery = useQuery({
    queryKey: ['vacancies', filterParams, page, pageSize],
    queryFn: async ({ signal }): Promise<ListResult> => {
      try {
        const res = await api.get('/vacancies', { params: { ...filterParams, page, per_page: pageSize }, signal })
        const { rows, total, lastPage } = unwrapList<ApiVacancy>(res)
        return { vacancies: rows.map(mapVacancy), total, lastPage }
      } catch (err) {
        if ((err as { response?: { status?: number } })?.response?.status === 404) return { vacancies: [], total: 0, lastPage: 1 }
        throw err
      }
    },
    placeholderData: keepPreviousData,
  })

  const vacancies = listQuery.data?.vacancies ?? []
  const total     = listQuery.data?.total ?? 0
  const lastPage  = listQuery.data?.lastPage ?? 1
  const loading   = listQuery.isLoading
  const error     = listQuery.isError ? t('page.loadError') : null

  // Stats (server-wide totals; honour the filters).
  const { data: stats = null } = useQuery({
    queryKey: ['vacancies', 'stats', filterParams],
    queryFn: async ({ signal }): Promise<VacancyStats | null> => {
      const res = await api.get('/vacancies/stats', { params: filterParams, signal })
      return (res.data?.data ?? res.data ?? null) as VacancyStats | null
    },
  })

  // Setter wrappers over the list cache — keep the container's optimistic mutations working.
  const setVacancies = useCallback<Dispatch<SetStateAction<Vacancy[]>>>(updater => {
    queryClient.setQueryData<ListResult>(['vacancies', filterParams, page, pageSize], prev => {
      const cur = prev ?? { vacancies: [], total: 0, lastPage: 1 }
      return { ...cur, vacancies: typeof updater === 'function' ? (updater as (p: Vacancy[]) => Vacancy[])(cur.vacancies) : updater }
    })
  }, [queryClient, filterParams, page, pageSize])

  const setTotal = useCallback<Dispatch<SetStateAction<number>>>(updater => {
    queryClient.setQueryData<ListResult>(['vacancies', filterParams, page, pageSize], prev => {
      const cur = prev ?? { vacancies: [], total: 0, lastPage: 1 }
      return { ...cur, total: typeof updater === 'function' ? (updater as (p: number) => number)(cur.total) : updater }
    })
  }, [queryClient, filterParams, page, pageSize])

  return { vacancies, setVacancies, loading, error, total, setTotal, lastPage, stats, customers }
}
