/**
 * useCandidateNotes — the candidate's note thread, wired to the API (G-1).
 *
 * Was FE-state-only in CommunicationTab (a note vanished on close = AVG data loss).
 * Mirrors the customer/vacancy/opportunity note-pads: load once, then optimistic
 * add/edit/delete that reconcile against the server so a note actually persists.
 *
 * Contract (mirror of the other entities' note endpoints):
 *   GET    /candidates/{id}/notes          → { data: [ { id, type, channel, body, author, author_id, language, created_at } ] } (newest first)
 *   POST   /candidates/{id}/notes          { text, type?, channel?, language? } → 201 { …note }
 *   PATCH  /candidates/{id}/notes/{note}   { text?, type?, channel?, language? } → 200 { …note }
 *   DELETE /candidates/{id}/notes/{note}   → 204
 * NOTE-TAAL-1 (06-08): `language` is optional on both writes — omitted/undefined
 * means "keep the tenant default", never forced by the FE.
 * author is set server-side (logged-in user); body is encrypted-at-rest (plain text
 * over the wire); type is a value from /note-types. `channel` is a value from
 * /last-contact-types — when present the backend stamps the candidate's
 * last_contact_at/_type/_by (C-21).
 *
 * RECHTEN-DETAIL-1 (Danny 06-08, "notitie-eigenaarschap"): every note now also
 * carries `author_id` (the creator's central user id; null on a legacy pre-
 * migration note). PATCH/DELETE 403 server-side unless the note is the caller's
 * own or the caller holds `candidates.notes.manage_all` — the shared NotesTab
 * reads `author_id` off each note (see its NoteItem/canManageNote) to hide the
 * edit/delete buttons before that 403 can ever happen; this hook just has to keep
 * threading the field through, which unwrapList already does structurally (no
 * per-field mapping here) — declared explicitly below for type safety.
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
  // RECHTEN-DETAIL-1: creator's user id — null = system/legacy note (not self-claimable).
  author_id?: string | number | null
  created_at?: string
  // NOTE-TAAL-1: the note's own spellcheck/output language — null/absent = tenant default.
  language?: string
  [k: string]: unknown
}

// NotesTab hands back the editor payload on save (both add and edit).
interface NotePayload { type: string; title: string; body: string; channel?: string; language?: string }

// LAST-CONTACT-REFRESH-1 (Danny 05-08): a channel-note stamps last_contact server-side
// (CandidateNote::booted → recordContact, live-proven) but the drawer kept showing the
// stale value — the caller passes onContactStamped to refresh its record after the write.
export function useCandidateNotes(candidateId: string | number | undefined, opts?: { onContactStamped?: () => void }) {
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
    api.post(`/candidates/${candidateId}/notes`, { type: payload.type, text: payload.body, channel: payload.channel, language: payload.language })
      .then(() => { load(); if (payload.channel) opts?.onContactStamped?.() })
      .catch(() => { setNotes(prev => prev.filter(n => n.id !== temp.id)); notifyError(t('common:actionFailed')) })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- opts is a caller-literal; the callback identity must not retrigger
  }, [candidateId, load, t])

  // Edit — NotesTab passes a list index; optimistic, then reload so "edited by ·when" shows.
  const editNote = useCallback((index: number, payload: NotePayload) => {
    if (!candidateId) return
    const target = notes[index]
    if (!target) return
    const snapshot = notes
    setNotes(prev => prev.map((n, i) => (i === index ? { ...n, type: payload.type, channel: payload.channel, body: payload.body, language: payload.language } : n)))
    api.patch(`/candidates/${candidateId}/notes/${target.id}`, { text: payload.body, type: payload.type, channel: payload.channel, language: payload.language })
      .then(() => load())
      .catch(() => { setNotes(snapshot); notifyError(t('common:actionFailed')) })
  }, [candidateId, notes, load, t])

  // Delete — optimistic remove with revert. NotesTab now has the gated delete
  // button (RECHTEN-DETAIL-1); the host still needs to pass this as onDeleteNote
  // (mirrors editUserNote's index-remapping past the filtered system notes) for
  // the button to actually appear on a candidate's Notities tab.
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
