/**
 * useOpportunityNotes — the notes on an opportunity (GET/POST/PUT/DELETE
 * /opportunities/{id}/notes, backend C-41). Contract {id,author,body,type,created_at},
 * mirroring the candidate/customer notes. 404 = endpoint not built yet → empty (calm).
 *
 * OPP-NOTE-EDIT-1 (CMBE golf 2a/2b, G23): `editNote` PUTs
 * /opportunities/{id}/notes/{note} with {body, type?, language?} — the response
 * now carries `updated_by`/`updated_at` too, mirroring useCandidateNotes.editNote.
 * Opportunity notes carry no `author_id` (not migrated onto the RECHTEN-DETAIL-1
 * ownership model), so the shared NotesTab's edit pencil stays unrestricted here —
 * matches the pre-existing store()/destroy() behaviour.
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
  // NOTE-TAAL-1: the note's own spellcheck/output language — null/absent = tenant default.
  language?: string
  // OPP-NOTE-EDIT-1 (G23): who last edited the note (denormalised name) + when —
  // absent/undefined on a note that was never edited (the API sends `null`;
  // typed without it to match the shared NotesTab's NoteItem.updated_by shape).
  updated_by?: string
  updated_at?: string
  // NOTE-UNDO-FE-1 (K-172): true once the note carries a filled one-slot undo.
  has_previous_version?: boolean
  [k: string]: unknown
}

// CRUD notes for one opportunity; a 404 (endpoint not yet built for this tenant) degrades to a calm empty list instead of an error banner.
export function useOpportunityNotes(id?: Id) {
  const { t } = useTranslation()
  const [items,   setItems]   = useState<OpportunityNote[]>([])
  const [loading, setLoading] = useState(false)
  // Audit r4 (§3/§10): a real load failure must not render as "no notes yet" —
  // 404 stays the calm not-built-yet empty; everything else (5xx, network/no
  // response) flags error, mirroring useOpportunityActivity.
  const [error,   setError]   = useState(false)

  // Fetches the note list for the current id; any non-404 failure sets error so the empty state never lies about it.
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

  // Loads notes on mount/id change, aborting the in-flight request if the id changes again before it resolves.
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
  // NOTE-TAAL-1: `language` is optional and forwarded to the API as-is (undefined = tenant default).
  const addNote = useCallback((payload: { type: string; body: string; language?: string }) => {
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

  // Edit — OPP-NOTE-EDIT-1 (G23): PUT /opportunities/{id}/notes/{note}
  // {body, type?, language?}. NotesTab passes a list index (mirrors
  // useCandidateNotes.editNote); optimistic locally, then reload so the
  // server-resolved `updated_by`/`updated_at` (edited-by meta) shows at once.
  const editNote = useCallback((index: number, payload: { type: string; body: string; language?: string }) => {
    if (!id) return
    const target = items[index]
    if (!target?.id) return
    const snapshot = items
    setItems(prev => prev.map((n, i) => (i === index ? { ...n, type: payload.type, body: payload.body, language: payload.language } : n)))
    api.put(`/opportunities/${id}/notes/${target.id}`, payload)
      .then(() => load())
      .catch(err => {
        setItems(snapshot)
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }, [id, items, load, t])

  // Delete — NOTITIE-PARITEIT (Danny 27-08): DELETE /opportunities/{id}/notes/{note}
  // exists on the backend (opportunities.php route); mirrors editNote's optimistic
  // remove + revert-on-failure, index-keyed like editNote/onDeleteNote everywhere else.
  const deleteNote = useCallback((index: number) => {
    if (!id) return
    const target = items[index]
    if (!target?.id) return
    const snapshot = items
    setItems(prev => prev.filter((_, i) => i !== index))
    api.delete(`/opportunities/${id}/notes/${target.id}`)
      .catch(err => {
        setItems(snapshot)
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
  }, [id, items, t])

  // NOTE-UNDO-FE-1 (K-172): peek the one-slot undo — GET /opportunities/{id}/notes/{note}/previous-version
  // → { data: { previous_body, previous_saved_at } }, nulls when there is no slot yet.
  const fetchPreviousVersion = useCallback((index: number) => {
    if (!id) return Promise.resolve(null)
    const target = items[index]
    if (!target?.id) return Promise.resolve(null)
    return api.get(`/opportunities/${id}/notes/${target.id}/previous-version`)
      .then(res => (res.data as { data?: { previous_body: string | null; previous_saved_at: string | null } })?.data ?? null)
      .catch(() => null)
  }, [id, items])

  // NOTE-UNDO-FE-1 (K-172): execute the undo — POST /opportunities/{id}/notes/{note}/restore-previous
  // → the note in this family's own shape. A 422 (no slot / guard failed) resolves false so
  // NotesTab degrades calmly instead of throwing.
  const restorePreviousVersion = useCallback((index: number): Promise<boolean> => {
    if (!id) return Promise.resolve(false)
    const target = items[index]
    if (!target?.id) return Promise.resolve(false)
    return api.post(`/opportunities/${id}/notes/${target.id}/restore-previous`)
      .then(() => { load(); return true })
      .catch(() => false)
  }, [id, items, load])

  return { items, loading, error, addNote, editNote, deleteNote, fetchPreviousVersion, restorePreviousVersion }
}
