/**
 * useAliveListFetch — the alive-guarded list-fetch shape shared by the
 * Shiftmanager report hooks (useReportCandidates/useReportCustomers): GET a
 * URL, map the response into rows, expose { data, loading, error }, and drop a
 * late response if the URL changed or the hook unmounted before it resolved
 * (§9 every entity-keyed load effect carries an alive guard). `mapResponse`
 * must be a STABLE reference (module-scope, not created per render) — it is a
 * dependency of the effect, so a fresh closure each render would refetch in a loop.
 */
import { useState, useEffect } from 'react'
import type { AxiosResponse } from 'axios'
import api from '@/lib/api'

export function useAliveListFetch<T>(
  url: string,
  mapResponse: (res: AxiosResponse) => T[],
): { data: T[]; loading: boolean; error: boolean } {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true); setError(false)
    api.get(url)
      .then(res => { if (active) setData(mapResponse(res)) })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [url, mapResponse])

  return { data, loading, error }
}
