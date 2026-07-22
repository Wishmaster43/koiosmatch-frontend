import { useEffect, useState } from 'react'
import { fetchVacancies, type VacancyListParams } from '../api'
import type { PaginationMeta, VacancySummary } from '../types'

type Status = 'loading' | 'error' | 'success'

interface VacancyListState {
  status: Status
  vacancies: VacancySummary[]
  meta: PaginationMeta | null
}

// Fetches one page of the tenant's published vacancies. Deliberately destructures
// `params` into primitives for the effect's dependency array — depending on the
// object itself would re-fetch on every render, since callers pass a fresh literal.
export function useVacancies(tenant: string | undefined, params: VacancyListParams) {
  const { page, per_page, city, hours } = params
  const [state, setState] = useState<VacancyListState>({ status: 'loading', vacancies: [], meta: null })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!tenant) return
    // Guards against a stale response landing after filters/page changed again.
    let alive = true
    setState((prev) => ({ ...prev, status: 'loading' }))
    fetchVacancies(tenant, { page, per_page, city, hours })
      .then((res) => {
        if (!alive) return
        setState({ status: 'success', vacancies: res.data, meta: res.meta })
      })
      .catch(() => {
        if (!alive) return
        setState({ status: 'error', vacancies: [], meta: null })
      })
    return () => {
      alive = false
    }
  }, [tenant, page, per_page, city, hours, reloadToken])

  // Re-runs the same request — used by the list's "retry" action on error.
  const refetch = () => setReloadToken((token) => token + 1)

  return { ...state, refetch }
}
