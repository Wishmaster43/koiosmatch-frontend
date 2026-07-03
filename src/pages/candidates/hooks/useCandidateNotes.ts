/**
 * useCandidateNotes — the candidate's note thread, wired to the API (G-1).
 *
 * Was FE-state-only in CommunicationTab (a note vanished on close = AVG data loss).
 * Mirrors the customer/vacancy/opportunity note-pads: load once, then optimistic
 * add/edit/delete that reconcile against the server so a note actually persists.
 *
 * Contract (mirror of the other entities' note endpoints):
 *   GET    /candidates/{id}/notes          → { data: [ { id, type, channel, body, author, created_at } ] } (newest first)
 *   POST   /candidates/{id}/notes          { text, type?, channel? } → 201 { …note }
 *   PATCH  /candidates/{id}/notes/{note}   { text?, type?, channel? } → 200 { …note }
 *   DELETE /candidates/{id}/notes/{note}   → 204
 * author is set server-side (logged-in user); body is encrypted-at-rest (plain text
 * over the wire); type is a value from /note-types. `channel` is a value from
 * /last-contact-types — when present the backend stamps the candidate's
 * last_contact_at/_type/_by (C-21). Reads/writes are perm-gated + IDOR-safe BE-side.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'

// One note as the drawer renders it — matches NotesTab's NoteItem + the API shape.
export interface CandidateNote {
  id: string | number
  type?: string
  channel?: string
  body?: string
  author?: string
  created_at?: string
  [k: string]: unknown
}

// NotesTab hands back the editor payload on save (both add and edit).
interface NotePayload { type: string; title: string; body: string; channel?: string }

export function useCandidateNotes(candidateId: string | number | undefined) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState<CandidateNote[]>([])

  // One loader — the effect uses it, and every successful write RE-FETCHES the thread so
  // the server truth (author, updated_by/updated_at, stamped last-contact) shows at once.
  const load = useCallback(() => {
    if (!candidateId) { setNotes([]); return }
    api.get(`/candidates/${candidateId}/notes`)
      .then(res => setNotes(unwrapList<CandidateNote>(res).rows))
      // GET degrades to an empty thread; the dev interceptor already surfaces write errors.
      .catch(() => setNotes([]))
  }, [candidateId])

  // Load the thread whenever the candidate changes (server returns newest-first).
  useEffect(() => { load() }, [load])

  // Create — optimistic prepend, then reload the thread (real id/author/last-contact stamp).
  const addNote = useCallback((payload: NotePayload) => {
    if (!candidateId) return
    const temp: CandidateNote = {
      id: `tmp-${Date.now()}`, type: payload.type, channel: payload.channel, body: payload.body, created_at: new Date().toISOString(),
    }
    setNotes(prev => [temp, ...prev])
    api.post(`/candidates/${candidateId}/notes`, { type: payload.type, text: payload.body, channel: payload.channel })
      .then(() => load())
      .catch(() => { setNotes(prev => prev.filter(n => n.id !== temp.id)); notifyError(t('common:actionFailed')) })
  }, [candidateId, load, t])

  // Edit — NotesTab passes a list index; optimistic, then reload so "edited by ·when" shows.
  const editNote = useCallback((index: number, payload: NotePayload) => {
    if (!candidateId) return
    const target = notes[index]
    if (!target) return
    const snapshot = notes
    setNotes(prev => prev.map((n, i) => (i === index ? { ...n, type: payload.type, channel: payload.channel, body: payload.body } : n)))
    api.patch(`/candidates/${candidateId}/notes/${target.id}`, { text: payload.body, type: payload.type, channel: payload.channel })
      .then(() => load())
      .catch(() => { setNotes(snapshot); notifyError(t('common:actionFailed')) })
  }, [candidateId, notes, load, t])

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
