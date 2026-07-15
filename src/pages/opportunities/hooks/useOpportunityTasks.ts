/**
 * useOpportunityTasks — the tasks linked to an opportunity (GET /opportunities/{id}/tasks,
 * backend C-42). 404 = endpoint not built yet → empty (calm). Read-only list for the tab.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface OpportunityTask {
  id?: Id
  title?: string
  status?: string
  status_label?: string
  status_color?: string
  due_at?: string
  due_date?: string
  owner_name?: string
  [k: string]: unknown
}

export function useOpportunityTasks(id?: Id): { items: OpportunityTask[]; loading: boolean; error: boolean; reload: () => void } {
  const [items,   setItems]   = useState<OpportunityTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)
  // Bump to refetch (e.g. after "+ Nieuwe taak" from the tab).
  const [epoch, setEpoch] = useState(0)

  useEffect(() => {
    if (!id) { setItems([]); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/opportunities/${id}/tasks`, { signal: ctrl.signal })
      .then(res => setItems(unwrapList<OpportunityTask>(res).rows))
      .catch(err => {
        if (err?.code === 'ERR_CANCELED') return
        if (err?.response?.status && err.response.status !== 404) setError(true)
        setItems([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [id, epoch])

  return { items, loading, error, reload: () => setEpoch(e => e + 1) }
}
