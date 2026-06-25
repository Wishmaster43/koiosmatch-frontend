/**
 * useVacanciesData — data layer for VacanciesPage: loads the customers (for the
 * filter/drawer/modal/bulk pickers), the paginated + server-filtered vacancy list
 * and the server-wide stats. Returns the setters so optimistic bulk/drawer updates
 * in the container can mutate the list directly.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import { USE_MOCKS, isAbortError } from '@/lib/mocks'
import { mapVacancy } from '../data/mapVacancy'

export function useVacanciesData({ filterParams, page, pageSize, t }) {
  const [vacancies, setVacancies] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [total,     setTotal]     = useState(0)
  const [lastPage,  setLastPage]  = useState(1)
  const [stats,     setStats]     = useState(null)
  const [customers, setCustomers] = useState([])

  // Load the customers once for the filters/drawer/modal/bulk pickers.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/customers', { signal: ctrl.signal })
      .then(res => setCustomers(unwrapList(res).rows.map(c => ({ id: c.id, name: c.name ?? c.company_name ?? '—' }))))
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  // ── List (paginated, server-filtered) ──
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true); setError(null)
    api.get('/vacancies', { params: { ...filterParams, page, per_page: pageSize }, signal: ctrl.signal })
      .then(res => {
        const { rows, total, lastPage } = unwrapList(res)
        setVacancies(rows.map(mapVacancy)); setTotal(total); setLastPage(lastPage)
      })
      .catch(err => {
        if (isAbortError(err)) return
        // A 404 means the endpoint isn't built yet → empty, not an error.
        if (err?.response?.status && err.response.status !== 404 && !USE_MOCKS) {
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
