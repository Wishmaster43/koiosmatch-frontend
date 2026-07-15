/**
 * useOpportunityActivity — the opportunity audit trail (who changed what, when).
 * Fetches GET /opportunities/{id}/activity (the controller already logs via
 * activity('opportunities')). A 404 = read endpoint not built yet → treat as empty
 * (calm), not a hard error. Mirrors useCandidateActivity.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface OpportunityActivityEvent {
  id?: Id
  causer_name?: string
  created_at?: string
  description?: string
  log_name?: string
  ip?: string
  [k: string]: unknown
}

export function useOpportunityActivity(id?: Id): { items: OpportunityActivityEvent[]; loading: boolean; error: boolean } {
  const [items,   setItems]   = useState<OpportunityActivityEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!id) { setItems([]); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/opportunities/${id}/activity`, { signal: ctrl.signal })
      .then(res => setItems(unwrapList<OpportunityActivityEvent>(res).rows))
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
