/**
 * useVacanciesData — data layer for VacanciesPage: loads the customers (for the
 * filter/drawer/modal/bulk pickers), the paginated + server-filtered vacancy list
 * and the server-wide stats. Returns the setters so optimistic bulk/drawer updates
 * in the container can mutate the list directly.
 */
import { useState, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
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

export function useVacanciesData({ filterParams, page, pageSize, t }: UseVacanciesDataArgs): UseVacanciesDataResult {
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [total,     setTotal]     = useState(0)
  const [lastPage,  setLastPage]  = useState(1)
  const [stats,     setStats]     = useState<VacancyStats | null>(null)
  const [customers, setCustomers] = useState<VacancyCustomer[]>([])

  // Load the customers once for the filters/drawer/modal/bulk pickers.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/customers', { signal: ctrl.signal })
      .then(res => setCustomers(unwrapList<{ id?: Id; name?: string; company_name?: string }>(res).rows.map(c => ({ id: c.id, name: c.name ?? c.company_name ?? '—' }))))
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  // ── List (paginated, server-filtered) ──
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setError(null)
    api.get('/vacancies', { params: { ...filterParams, page, per_page: pageSize }, signal: ctrl.signal })
      .then(res => {
        const { rows, total, lastPage } = unwrapList<ApiVacancy>(res)
        setVacancies(rows.map(mapVacancy)); setTotal(total); setLastPage(lastPage)
      })
      .catch(err => {
        if (isAbortError(err)) return
        // A 404 means the endpoint isn't built yet → empty, not an error.
        if (err?.response?.status && err.response.status !== 404) {
          setError(t('page.loadError'))
        }
        setVacancies([]); setTotal(0); setLastPage(1)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [filterParams, page, pageSize, t])

  // ── Stats (server-wide totals; honour the filters) ──
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/vacancies/stats', { params: filterParams, signal: ctrl.signal })
      .then(res => setStats(res.data?.data ?? res.data ?? null))
      .catch(err => { if (!isAbortError(err)) setStats(null) })
    return () => ctrl.abort()
  }, [filterParams])

  return { vacancies, setVacancies, loading, error, total, setTotal, lastPage, stats, customers }
}
