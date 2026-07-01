/**
 * useCustomersData — the list data layer for CustomersPage (§3): the paginated,
 * server-filtered list + the server-wide stats. A missing endpoint (404) is an
 * empty list, not an error. Mirrors useCandidatesData / useVacanciesData.
 */
import { useState, useEffect } from 'react'
import type { TFunction } from 'i18next'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/mocks'
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

export function useCustomersData({ filterParams, page, pageSize, t }: Args) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [lastPage,  setLastPage]  = useState(1)
  const [total,     setTotal]     = useState(0)
  const [stats,     setStats]     = useState<PageStats | null>(null)
  const filterKey = JSON.stringify(filterParams)

  // List (paginated, server-filtered).
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setError(null)
    api.get('/customers', { params: { ...filterParams, page, per_page: pageSize }, signal: ctrl.signal })
      .then(res => {
        const { rows, total, lastPage } = unwrapList<ApiCustomer>(res)
        setCustomers(rows.map(mapCustomer)); setTotal(total); setLastPage(lastPage)
      })
      .catch(err => {
        if (isAbortError(err)) return
        // A 404 means the endpoint isn't built yet → treat as empty, not an error.
        if (err?.response?.status && err.response.status !== 404) setError(t('page.loadError'))
        setCustomers([]); setTotal(0); setLastPage(1)
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [filterKey, page, pageSize, t]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stats (server-wide totals, honour the filters).
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/customers/stats', { params: filterParams, signal: ctrl.signal })
      .then(res => setStats(res.data?.data ?? res.data ?? null))
      .catch(err => { if (!isAbortError(err)) setStats(null) })
    return () => ctrl.abort()
  }, [filterKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return { customers, setCustomers, loading, error, total, setTotal, lastPage, stats }
}
