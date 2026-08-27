/**
 * NotesTab — internal notes on a vacancy. VACANCY-NOTE-TYPE-1 (2026-08-04): rewritten
 * onto the SAME shared NotesTab family applications/opportunities use (mirrors
 * pages/applications/drawer/NotesTab.tsx), now that VacancyNoteController validates
 * `type` against the entity-scoped note_types lookup — the previous bespoke composer
 * had no type picker at all ("note TYPES stay as-is until NOTE-TYPES-3 lands", which
 * has now landed).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import SharedNotesTab from '@/components/drawer/tabs/NotesTab'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useAuth } from '@/context/AuthContext'
import type { VacancyDetail } from '@/types/vacancy'

// Structural match for the shared NotesTab's NoteItem (typed fields + open index).
interface Note { type?: string; title?: string; author?: string; text?: string; body?: string; created_at?: string; time?: string; [k: string]: unknown }

// The vacancy notes tab, on the shared NotesTab family.
export default function NotesTab({ vacancy: v }: { vacancy: VacancyDetail }) {
  const { t } = useTranslation('vacancies')
  // Note categories from the tenant lookup, scoped to 'vacancy' (NOTE-TYPES-2/3).
  const { writableTypes: noteTypes } = useNoteTypes('vacancy')
  const [notes, setNotes] = useState<Note[]>((v.notes ?? []) as Note[])
  // AUTHOR-CURRENT-USER-1: the note being composed is written by the LOGGED-IN
  // user, never the vacancy's owning recruiter — those can differ (a colleague
  // covering someone else's vacancy). Mirrors useCandidateNotes/ScopedNotesTab.
  const auth = useAuth()
  const currentUserName = auth?.user?.name || 'Koios'

  // Author avatar initials — the current user composing the note.
  const initials = currentUserName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  // Optimistic add, then persist. OPTIMISTIC-REVERT-1 pattern (mirrors applications):
  // on failure the exact optimistic object is removed again and the server's own
  // message surfaced — never a silently-stuck fake note. NOTE-TAAL-1: `payload` is
  // forwarded to the API AS-IS, so the optional `language` field rides along for free.
  const addNote = (payload: { type: string; title: string; body: string; language?: string }) => {
    const local: Note = { ...payload, text: payload.body, author: currentUserName, created_at: new Date().toISOString() }
    setNotes(prev => [local, ...prev])
    if (v.id != null) {
      api.post(`/vacancies/${v.id}/notes`, payload).catch(err => {
        setNotes(prev => prev.filter(n => n !== local))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
    }
  }

  // NOTITIE-PARITEIT (Danny 27-08): PATCH + DELETE both exist since CMBE
  // 1049413a (VacancyNoteController::update/destroy) — full candidate parity.
  // Index-keyed like every other family; the note's own id must have resolved
  // (never a local optimistic-only add) before it can be edited or deleted.
  const editNote = (i: number, payload: { type: string; title: string; body: string; language?: string }) => {
    const target = notes[i]
    const noteId = target?.id
    if (v.id == null || noteId == null) return
    const snapshot = notes
    setNotes(prev => prev.map((n, idx) => idx === i ? { ...n, ...payload, text: payload.body } : n))
    api.patch(`/vacancies/${v.id}/notes/${noteId}`, { ...payload, text: payload.body }).catch(err => {
      setNotes(snapshot)
      notifyError(extractApiError(err, t('common:actionFailed')))
    })
  }
  const deleteNote = (i: number) => {
    const target = notes[i]
    const noteId = target?.id
    if (v.id == null || noteId == null) return
    const snapshot = notes
    setNotes(prev => prev.filter((_, idx) => idx !== i))
    api.delete(`/vacancies/${v.id}/notes/${noteId}`).catch(err => {
      setNotes(snapshot)
      notifyError(extractApiError(err, t('common:actionFailed')))
    })
  }

  return (
    <SharedNotesTab
      notes={notes}
      onAddNote={addNote}
      onEditNote={editNote}
      onDeleteNote={deleteNote}
      noteTypes={noteTypes}
      authorInitials={initials}
      showTimeline={false}
      showConversations={false}
      // F5-uitbreiding: which record the shared tab may pop out (named window —
      // reopening focuses the existing one). Since NOTITIE-POPOUT-HANDOFF-1 the tab
      // owns opening it, the blocked-popup notice AND handing a half-typed note
      // over, so this host only names the target (mirrors CommunicationTab).
      // NOTITIE-POPOUT-EDIT-1: naming it does NOT give a vacancy note the per-note
      // "edit on the second screen" icon — VacancyNotesPopout can only ADD (the API
      // has no PATCH for a single vacancy note), so handing an existing note there
      // would save a duplicate. Popping a NEW note out of the composer still works.
      popout={{ entity: 'vacancy', id: String(v.id) }}
      labels={{
        notes: t('notes.title'),
        newNote: t('notes.new'),
        type: t('notes.type'),
        save: t('notes.save'),
        cancel: t('notes.cancel'),
        notesEmpty: t('notes.empty'),
        notePlaceholder: () => t('notes.placeholder'),
        searchPlaceholder: t('notes.searchPlaceholder'),
        edit: t('notes.edit'),
        deleteNote: t('notes.deleteNote'),
        deleteConfirm: t('notes.deleteConfirm'),
      }}
    />
  )
}
