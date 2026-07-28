/**
 * useOpportunityNotes — the notes on an opportunity (GET/POST/DELETE
 * /opportunities/{id}/notes, backend C-41). Contract {id,author,body,type,created_at},
 * mirroring the candidate/customer notes. 404 = endpoint not built yet → empty (calm).
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
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
  const { t } = useTranslation()
  const [items,   setItems]   = useState<OpportunityNote[]>([])
  const [loading, setLoading] = useState(false)
  // Audit r4 (§3/§10): a real load failure must not render as "no notes yet" —
  // 404 stays the calm not-built-yet empty; everything else (5xx, network/no
  // response) flags error, mirroring useOpportunityActivity.
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

  // Add a note. Bug class fix + honesty decision: this used to
  // `.then(load).catch(() => {})` with NO optimistic write and a swallowed error —
  // a rejected POST left no trace on screen and no message, so a recruiter had every
  // reason to believe the note was recorded and would not re-type it. Mirrors the
  // proven useCandidateNotes.addNote pattern instead: show the note immediately
  // (optimistic prepend with a temp id), reload for the server-resolved id/author on
  // success, and on failure remove that exact temp note + surface the server's own
  // reason — never leave a failed note lingering as if it had saved.
  const addNote = useCallback((payload: { type: string; body: string }) => {
    if (!id || !payload.body.trim()) return
    const temp: OpportunityNote = { id: `tmp-${Date.now()}`, type: payload.type, body: payload.body, created_at: new Date().toISOString() }
    setItems(prev => [temp, ...prev])
    api.post(`/opportunities/${id}/notes`, payload)
      .then(() => load())
      .catch(err => {
        setItems(prev => prev.filter(n => n.id !== temp.id))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }, [id, load, t])

  return { items, loading, error, addNote }
}
