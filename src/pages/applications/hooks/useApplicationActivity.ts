/**
 * useApplicationActivity — the application audit trail (who changed what, when).
 * Fetches GET /applications/{id}/activity (EntityChangelogController::application).
 * A 404 = read endpoint not built yet → treat as empty (calm), not a hard error.
 * Mirrors useOpportunityActivity / useMatchActivity so every entity's changelog
 * behaves identically (§3A).
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import type { Id } from '@/types/common'

export interface ApplicationActivityEvent {
  id?: Id
  causer_name?: string
  created_at?: string
  description?: string
  log_name?: string
  // Field-level old→new diff bag (EntityChangelogController::formatActivityEntry) —
  // used to suppress a stage-only entry already covered by the Timeline tab (below).
  changes?: { attributes?: Record<string, unknown>; old?: Record<string, unknown> }
  [k: string]: unknown
}

export function useApplicationActivity(id?: Id): { items: ApplicationActivityEvent[]; loading: boolean; error: boolean } {
  const [items,   setItems]   = useState<ApplicationActivityEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!id) { setItems([]); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/applications/${id}/activity`, { signal: ctrl.signal })
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
