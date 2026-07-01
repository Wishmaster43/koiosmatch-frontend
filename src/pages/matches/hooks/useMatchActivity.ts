/**
 * useMatchActivity — the match audit trail (who changed what, when). Fetches
 * GET /matches/{id}/activity. A 404 = read endpoint not built yet → treat as
 * empty (calm), not a hard error. Mirrors useOpportunityActivity /
 * useCandidateActivity so every entity's changelog behaves identically (§3A).
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import type { Id } from '@/types/common'

export interface MatchActivityEvent {
  id?: Id
  causer_name?: string
  created_at?: string
  description?: string
  log_name?: string
  [k: string]: unknown
}

export function useMatchActivity(id?: Id): { items: MatchActivityEvent[]; loading: boolean; error: boolean } {
  const [items,   setItems]   = useState<MatchActivityEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!id) { setItems([]); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/matches/${id}/activity`, { signal: ctrl.signal })
      .then(res => setItems(res.data?.data ?? res.data ?? []))
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
