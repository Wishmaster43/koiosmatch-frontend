/**
 * useEntityTasks — the tasks linked to ONE record, whatever its type:
 * GET /tasks?<linkType>=<id> (candidate | application | vacancy | match | customer |
 * opportunity | location | department | contact | workflow).
 *
 * MEASURED 2026-07-28: the backend's TaskQuery now generates one filter per link
 * token straight from TaskLinkResolver::types(), so every entity gets a working
 * reverse lookup for free (TASKS-LINK-FILTER-1). Before that only two of them were
 * hand-written and the rest were silently ignored — which is why the customer Taken
 * list was deliberately never built: an ignored filter returns EVERY task in the
 * tenant, and a list that lies is worse than no list. That is fixed, so this hook is
 * the one place the whole app reads "the tasks for this record".
 *
 * A 404 stays calm (empty, no error banner) — the route existing but returning
 * nothing is a normal state; a network/5xx failure is a real error.
 */
import { useState, useEffect, useCallback } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

/** One task row as the list endpoint returns it (read defensively — the shape is the shared TaskListResource). */
export interface EntityTask {
  id?: Id
  title?: string
  status?: unknown
  status_label?: string
  status_color?: string
  due_at?: string
  due_date?: string
  completed_at?: string | null
  owner_name?: string
  [k: string]: unknown
}

// Generic reverse-lookup hook: fetches the tasks linked to one record via the shared /tasks?<linkType>=<id> filter (see the module doc above for why every entity works uniformly now).
export function useEntityTasks(linkType: string, id?: Id): { items: EntityTask[]; loading: boolean; error: boolean; reload: () => void } {
  const [items, setItems] = useState<EntityTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  // Bump to refetch (e.g. after creating a task from the tab).
  const [epoch, setEpoch] = useState(0)

  // Fetches whenever the link target or epoch changes; aborts on unmount/id-change, and a 404 is treated as calmly empty rather than an error (see note below).
  useEffect(() => {
    if (!id) { setItems([]); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get('/tasks', { params: { [linkType]: String(id), per_page: 100 }, signal: ctrl.signal })
      .then(res => { if (!ctrl.signal.aborted) setItems(unwrapList<EntityTask>(res).rows) })
      .catch(err => {
        if (err?.code === 'ERR_CANCELED' || ctrl.signal.aborted) return
        // A 404 is calm (nothing there); anything else — including a no-response
        // network failure — is a real error the user must see.
        if (err?.response?.status !== 404) setError(true)
        setItems([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [linkType, id, epoch])

  // Stable trigger to force a refetch (e.g. after creating a task from the tab) without needing a new function identity each render.
  const reload = useCallback(() => setEpoch(e => e + 1), [])

  return { items, loading, error, reload }
}
