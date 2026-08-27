/**
 * useEntityNotes — the fetch/optimistic-add/retry machinery SHARED by every
 * detail-only entity notes tab (matches, tasks — NOTES-TWINS-1, §11). Both
 * entities' detail models carry no preloaded notes array, so each tab fetches its
 * own list once per record from `${basePath}/notes`. OPTIMISTIC-REVERT-1: on POST
 * failure the exact optimistic note is removed again and the server's own message
 * surfaced — never a silently-stuck fake note. This hook owns only the data;
 * rendering (labels, the shared NotesTab wiring) stays with each entity's thin tab.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useAuth } from '@/context/AuthContext'
import type { Id } from '@/types/common'

// Structural match for the shared NotesTab's NoteItem (typed fields + open index).
export interface EntityNote { type?: string; title?: string; author?: string; text?: string; body?: string; created_at?: string; [k: string]: unknown }

export interface UseEntityNotesResult {
  notes: EntityNote[]
  loading: boolean
  error: boolean
  fetchNotes: () => void
  addNote: (payload: { type: string; title: string; body: string; language?: string }) => void
  // NOTITIE-PARITEIT (Danny 27-08): edit/delete, index-keyed like every other
  // family (candidates/customers/opportunities) — only wired by a host whose
  // entity actually has the matching PATCH/DELETE route (see each caller).
  // POPOUT-PARITEIT-1: editNote resolves TRUE only on a landed write — the
  // per-note popout's PopoutSaveFooter contract requires an honest signal
  // (never "resolved" before the PATCH actually lands, §3).
  editNote: (i: number, payload: { type: string; title: string; body: string; language?: string }) => Promise<boolean>
  deleteNote: (i: number) => void
}

// Fetches and optimistically mutates one record's notes list; see file docblock.
// AUTHOR-CURRENT-USER-1: the optimistic note stamps the CURRENT logged-in user
// (mirrors useCandidateNotes), never the record's owner — a match/task owner is
// not necessarily who is typing the note right now.
export function useEntityNotes({ id, basePath }: { id: Id | null | undefined; basePath: string }): UseEntityNotesResult {
  const { t } = useTranslation('common')
  const auth = useAuth()
  const authorName = auth?.user?.name || [auth?.user?.firstname, auth?.user?.lastname].filter(Boolean).join(' ') || ''
  const [notes, setNotes] = useState<EntityNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // Freshness guard (§9): a monotonic request id, not just a boolean, since the
  // retry button can start a SECOND fetch while an earlier one is still in
  // flight — only the most recent request's response/error may land in state.
  const requestIdRef = useRef(0)

  // Detail-only data (§8): fetch this record's notes, callable from BOTH the
  // mount/id-switch effect below AND the load-error retry button (04-08), so a
  // retry re-runs the exact same request instead of a bespoke copy.
  const fetchNotes = useCallback(() => {
    if (id == null) { setLoading(false); return }
    const requestId = ++requestIdRef.current
    setLoading(true); setError(false)
    api.get(`${basePath}/notes`)
      .then(r => { if (requestIdRef.current === requestId) setNotes(unwrapList<EntityNote>(r).rows) })
      .catch(e => { if (requestIdRef.current === requestId && e?.response?.status !== 404) setError(true) })
      .finally(() => { if (requestIdRef.current === requestId) setLoading(false) })
  }, [id, basePath])
  // A failed/missing list degrades to the empty state, never a stuck spinner.
  useEffect(() => { fetchNotes() }, [fetchNotes])

  // Optimistic add, then persist. NOTE-TAAL-1: `payload` is forwarded to the API
  // AS-IS, so the optional `language` field rides along for free.
  const addNote = useCallback((payload: { type: string; title: string; body: string; language?: string }) => {
    const local: EntityNote = { ...payload, text: payload.body, author: authorName, created_at: new Date().toISOString() }
    setNotes(prev => [local, ...prev])
    if (id != null) {
      // Refetch on success (mirrors useCandidateNotes) so the real id/author/
      // timestamp from the server replaces the optimistic stand-in.
      api.post(`${basePath}/notes`, payload).then(fetchNotes).catch(err => {
        setNotes(prev => prev.filter(n => n !== local))
        notifyError(extractApiError(err, t('actionFailed')))
      })
    }
  }, [id, basePath, authorName, t, fetchNotes])

  // Edit an existing note by its position in the list (mirrors addNote's
  // optimistic pattern, PATCH `${basePath}/notes/{id}` — only called by a host
  // whose entity has this route, e.g. tasks; a note without a resolved id
  // (still-optimistic) is skipped, mirroring vacancies/customers).
  const editNote = useCallback((i: number, payload: { type: string; title: string; body: string; language?: string }): Promise<boolean> => {
    const target = notes[i]
    const noteId = target?.id
    if (noteId == null) return Promise.resolve(false)
    const snapshot = notes
    setNotes(prev => prev.map((n, idx) => (idx === i ? { ...n, type: payload.type, title: payload.title, text: payload.body } : n)))
    // TaskCommentController::update validates `body` (not `text`) — send both so
    // every family's controller finds the field name it actually expects. Refetch
    // on success so "edited by ..." (server-stamped) actually shows.
    return api.patch(`${basePath}/notes/${noteId}`, { type: payload.type, title: payload.title, body: payload.body, text: payload.body, language: payload.language })
      .then(() => { fetchNotes(); return true })
      .catch(err => {
        setNotes(snapshot)
        notifyError(extractApiError(err, t('actionFailed')))
        return false
      })
  }, [notes, basePath, t, fetchNotes])

  // Delete an existing note by its position in the list (DELETE `${basePath}/notes/{id}`).
  const deleteNote = useCallback((i: number) => {
    const target = notes[i]
    const noteId = target?.id
    if (noteId == null) return
    const snapshot = notes
    setNotes(prev => prev.filter((_, idx) => idx !== i))
    api.delete(`${basePath}/notes/${noteId}`)
      .catch(err => {
        setNotes(snapshot)
        notifyError(extractApiError(err, t('actionFailed')))
      })
  }, [notes, basePath, t])

  return { notes, loading, error, fetchNotes, addNote, editNote, deleteNote }
}
