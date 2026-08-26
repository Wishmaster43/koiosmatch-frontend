/**
 * useEntityActivity — the shared "who changed what, when" fetch behind the
 * application/vacancy/match activity hooks (§3A — every entity's changelog
 * behaves identically). Fetches GET /{entityPath}/{id}/activity, aborting the
 * in-flight request on an id change/unmount, and treats a 404 (read endpoint
 * not built yet for this entity) as a calm empty list rather than a hard error.
 * Each entity keeps its own thin typed wrapper (its own event-field interface,
 * its own hook name) that just calls this with its own `entityPath`.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

/** The fields every entity's activity feed carries (LogsEntityActivity trait). */
export interface EntityActivityEvent {
  id?: Id
  causer_name?: string
  // Koios-performed action label ("<name>-KoiosAI") — wins over causer_name when present.
  actor_label?: string
  created_at?: string
  description?: string
  log_name?: string
  [k: string]: unknown
}

export interface UseEntityActivityResult<T> { items: T[]; loading: boolean; error: boolean }

// Fetches one entity's audit trail at GET /{entityPath}/{id}/activity, aborting the in-flight request on an id change/unmount and treating a 404 as a calm empty list rather than a hard error.
export function useEntityActivity<T extends EntityActivityEvent = EntityActivityEvent>(entityPath: string, id?: Id): UseEntityActivityResult<T> {
  const [items,   setItems]   = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)

  // Reload on every entity/id change, aborting the previous request: without that,
  // a fast switch between records can let an earlier response land on the newer one (§9).
  useEffect(() => {
    if (!id) { setItems([]); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/${entityPath}/${id}/activity`, { signal: ctrl.signal })
      .then(res => setItems(unwrapList<T>(res).rows))
      .catch(err => {
        if (err?.code === 'ERR_CANCELED') return
        // 404 = endpoint not built yet → treat as empty (calm), not a hard error.
        if (err?.response?.status && err.response.status !== 404) setError(true)
        setItems([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [entityPath, id])

  return { items, loading, error }
}
