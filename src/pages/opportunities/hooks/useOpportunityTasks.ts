/**
 * useOpportunityTasks — the tasks linked to an opportunity (GET /opportunities/{id}/tasks,
 * backend C-42). 404 = endpoint not built yet → empty (calm). Read-only list for the tab.
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
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

export function useOpportunityTasks(id?: Id): { items: OpportunityTask[]; loading: boolean; error: boolean } {
  const [items,   setItems]   = useState<OpportunityTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!id) { setItems([]); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/opportunities/${id}/tasks`, { signal: ctrl.signal })
      .then(res => setItems(res.data?.data ?? res.data ?? []))
      .catch(err => {
        if (err?.code === 'ERR_CANCELED') return
        if (err?.response?.status && err.response.status !== 404) setError(true)
        setItems([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [id])

  return { items, loading, error }
}
