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
import { fetchCalmList } from '@/hooks/fetchCalmList'
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
  // C-16/CHANGELOG-3: field-level diff (Spatie Activitylog shape) — `attributes` = the
  // new values, `old` = the previous values; the tab renders one "field: old → new" row
  // per change. Optional so entities without a diff-rendering changelog tab ignore it.
  properties?: { attributes?: Record<string, unknown>; old?: Record<string, unknown>; [k: string]: unknown }
  // The current backend resource exposes that diff bag as `changes` (properties = legacy key).
  changes?: { attributes?: Record<string, unknown>; old?: Record<string, unknown>; [k: string]: unknown }
  // Spatie event verb (created/updated/deleted/restored) — drives the friendly action line.
  event?: string
  // C-16: some entities' audit entries carry the subject + originating IP.
  subject_type?: string
  subject_id?: Id
  ip?: string
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
    // 404 = endpoint not built yet → treat as empty (calm), not a hard error.
    // Audit r5: a no-response network failure DOES count as an error (no truthy-status guard).
    fetchCalmList<T>(`/${entityPath}/${id}/activity`, ctrl.signal, setItems, setError)
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [entityPath, id])

  return { items, loading, error }
}
