/**
 * useOpportunityNotes — the notes on an opportunity (GET/POST/DELETE
 * /opportunities/{id}/notes, backend C-41). Contract {id,author,body,type,created_at},
 * mirroring the candidate/customer notes. 404 = endpoint not built yet → empty (calm).
 */
import { useState, useEffect, useCallback } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export interface OpportunityNote {
  id?: Id
  author?: string
  body?: string
  type?: string
  created_at?: string
  [k: string]: unknown
}

export function useOpportunityNotes(id?: Id) {
  const [items,   setItems]   = useState<OpportunityNote[]>([])
  const [loading, setLoading] = useState(false)
  // Audit r4 (§3/§10): a real load failure must not render as "no notes yet" —
  // 404 stays the calm not-built-yet empty; everything else (5xx, network/no
  // response) flags error, mirroring useOpportunityTasks/useOpportunityActivity.
  const [error,   setError]   = useState(false)

  const load = useCallback((signal?: AbortSignal) => {
    if (!id) { setItems([]); return }
    setLoading(true); setError(false)
    api.get(`/opportunities/${id}/notes`, { signal })
      .then(res => setItems(unwrapList<OpportunityNote>(res).rows))
      .catch(err => {
        if (err?.code === 'ERR_CANCELED') return
        // No-response network failures count as errors too (the truthy-status
        // guard elsewhere silently missed them — same class as the tasks fix).
        if (err?.response?.status !== 404) setError(true)
        setItems([])
      })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }, [id])

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  // Add a note (optimistic-ish: reload after the server confirms).
  const addNote = useCallback((payload: { type: string; body: string }) => {
    if (!id || !payload.body.trim()) return
    api.post(`/opportunities/${id}/notes`, payload).then(() => load()).catch(() => {})
  }, [id, load])

  return { items, loading, error, addNote }
}
