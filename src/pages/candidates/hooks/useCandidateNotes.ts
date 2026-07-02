/**
 * useCandidateNotes — the candidate's note thread, wired to the API (G-1).
 *
 * Was FE-state-only in CommunicationTab (a note vanished on close = AVG data loss).
 * Mirrors the customer/vacancy/opportunity note-pads: load once, then optimistic
 * add/edit/delete that reconcile against the server so a note actually persists.
 *
 * Contract (mirror of the other entities' note endpoints):
 *   GET    /candidates/{id}/notes          → { data: [ { id, type, body, author, created_at } ] } (newest first)
 *   POST   /candidates/{id}/notes          { text, type? } → 201 { …note }
 *   PATCH  /candidates/{id}/notes/{note}   { text?, type? } → 200 { …note }
 *   DELETE /candidates/{id}/notes/{note}   → 204
 * author is set server-side (logged-in user); body is encrypted-at-rest (plain text
 * over the wire); type is a value from /note-types. Reads/writes are perm-gated + IDOR-safe BE-side.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'

// One note as the drawer renders it — matches NotesTab's NoteItem + the API shape.
export interface CandidateNote {
  id: string | number
  type?: string
  body?: string
  author?: string
  created_at?: string
  [k: string]: unknown
}

// NotesTab hands back the editor payload on save (both add and edit).
interface NotePayload { type: string; title: string; body: string }

export function useCandidateNotes(candidateId: string | number | undefined) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState<CandidateNote[]>([])

  // Load the thread whenever the candidate changes (server returns newest-first).
  useEffect(() => {
    if (!candidateId) { setNotes([]); return }
    let alive = true
    api.get(`/candidates/${candidateId}/notes`)
      .then(res => { if (alive) setNotes(unwrapList<CandidateNote>(res).rows) })
      // GET degrades to an empty thread; the dev interceptor already surfaces write errors.
      .catch(() => { if (alive) setNotes([]) })
    return () => { alive = false }
  }, [candidateId])

  // Create — optimistic prepend, then swap the temp note for the server's (real id/author).
  const addNote = useCallback((payload: NotePayload) => {
    if (!candidateId) return
    const temp: CandidateNote = {
      id: `tmp-${Date.now()}`, type: payload.type, body: payload.body, created_at: new Date().toISOString(),
    }
    setNotes(prev => [temp, ...prev])
    api.post(`/candidates/${candidateId}/notes`, { type: payload.type, text: payload.body })
      .then(res => { const saved = unwrap<CandidateNote>(res); setNotes(prev => prev.map(n => (n.id === temp.id ? saved : n))) })
      .catch(() => { setNotes(prev => prev.filter(n => n.id !== temp.id)); notifyError(t('common:actionFailed')) })
  }, [candidateId, t])

  // Edit — NotesTab passes a list index; resolve to the note's real id, patch with revert.
  const editNote = useCallback((index: number, payload: NotePayload) => {
    if (!candidateId) return
    const target = notes[index]
    if (!target) return
    const snapshot = notes
    setNotes(prev => prev.map((n, i) => (i === index ? { ...n, type: payload.type, body: payload.body } : n)))
    api.patch(`/candidates/${candidateId}/notes/${target.id}`, { text: payload.body, type: payload.type })
      .catch(() => { setNotes(snapshot); notifyError(t('common:actionFailed')) })
  }, [candidateId, notes, t])

  // Delete — optimistic remove with revert (ready for a NotesTab delete affordance).
  const deleteNote = useCallback((index: number) => {
    if (!candidateId) return
    const target = notes[index]
    if (!target) return
    const snapshot = notes
    setNotes(prev => prev.filter((_, i) => i !== index))
    api.delete(`/candidates/${candidateId}/notes/${target.id}`)
      .catch(() => { setNotes(snapshot); notifyError(t('common:actionFailed')) })
  }, [candidateId, notes, t])

  return { notes, addNote, editNote, deleteNote }
}
