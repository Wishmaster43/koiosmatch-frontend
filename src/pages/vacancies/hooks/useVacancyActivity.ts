/**
 * useVacancyActivity — the vacancy audit trail (who changed what, when). Fetches
 * GET /vacancies/{id}/activity (EntityChangelogController::vacancy). A 404 = read
 * endpoint not built yet → treat as empty (calm), not a hard error. Mirrors
 * useOpportunityActivity / useMatchActivity so every entity's changelog behaves
 * identically (§3A).
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface VacancyActivityEvent {
  id?: Id
  causer_name?: string
  created_at?: string
  description?: string
  log_name?: string
  [k: string]: unknown
}

export function useVacancyActivity(id?: Id): { items: VacancyActivityEvent[]; loading: boolean; error: boolean } {
  const [items,   setItems]   = useState<VacancyActivityEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!id) { setItems([]); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/vacancies/${id}/activity`, { signal: ctrl.signal })
      .then(res => setItems(unwrapList<VacancyActivityEvent>(res).rows))
      .catch(err => {
        if (err?.code === 'ERR_CANCELED') return
        // 404 = endpoint not built yet → treat as empty (calm), not a hard error.
        if (err?.response?.status && err.response.status !== 404) setError(true)
        setItems([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [id])

  return { items, loading, error }
}
