import { useEffect, useState } from 'react'
import { fetchVacancy } from '../api'
import type { VacancyDetail } from '../types'

type Status = 'loading' | 'error' | 'success'

interface VacancyDetailState {
  status: Status
  vacancy: VacancyDetail | null
}

// Fetches one vacancy's full detail (description HTML, employment_type, JSON-LD).
export function useVacancy(tenant: string | undefined, reference: string | undefined) {
  const [state, setState] = useState<VacancyDetailState>({ status: 'loading', vacancy: null })

  useEffect(() => {
    if (!tenant || !reference) {
      setState({ status: 'error', vacancy: null })
      return
    }
    // Guards against a stale response landing after the route param changed again.
    let alive = true
    setState({ status: 'loading', vacancy: null })
    fetchVacancy(tenant, reference)
      .then((data) => {
        if (!alive) return
        setState({ status: 'success', vacancy: data })
      })
      .catch(() => {
        if (!alive) return
        setState({ status: 'error', vacancy: null })
      })
    return () => {
      alive = false
    }
  }, [tenant, reference])

  return state
}
