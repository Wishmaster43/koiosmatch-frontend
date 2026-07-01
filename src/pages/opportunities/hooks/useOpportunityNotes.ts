/**
 * useOpportunityNotes — the notes on an opportunity (GET/POST/DELETE
 * /opportunities/{id}/notes, backend C-41). Contract {id,author,body,type,created_at},
 * mirroring the candidate/customer notes. 404 = endpoint not built yet → empty (calm).
 */
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
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

  const load = useCallback((signal?: AbortSignal) => {
    if (!id) { setItems([]); return }
    setLoading(true)
    api.get(`/opportunities/${id}/notes`, { signal })
      .then(res => setItems(res.data?.data ?? res.data ?? []))
      .catch(() => setItems([]))
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

  return { items, loading, addNote }
}
