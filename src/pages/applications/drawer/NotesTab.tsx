import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SharedNotesTab from '@/components/drawer/tabs/NotesTab'
import { useNoteTypes } from '@/lib/useNoteTypes'
import type { ApplicationDetail } from '@/types/application'

// Rich-text editor tooltips (mirror the candidate drawer for a consistent look).
// Structural match for the shared NotesTab's NoteItem (typed fields + open index).
interface Note { type?: string; title?: string; author?: string; text?: string; body?: string; ago?: string; created_at?: string; [k: string]: unknown }

/**
 * NotesTab — internal notes for an application. Reuses the shared NotesTab so it
 * looks exactly like the candidate drawer (rich-text composer, type chips, note
 * cards); timeline/conversations are hidden here (the drawer has its own tabs).
 */
export default function NotesTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation('applications')
  // Note categories from the tenant lookup (seed fallback until /note-types lands).
  const { writableTypes: noteTypes } = useNoteTypes()
  const [notes, setNotes] = useState<Note[]>((a.notes ?? []) as Note[])

  // Author avatar initials — the owning recruiter, else a Koios fallback.
  const initials = (a.owner?.name ?? 'Koios').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  // Optimistic add + best-effort persist (endpoint lands with the applications detail API).
  const addNote = (payload: { type: string; title: string; body: string }) => {
    const local: Note = { ...payload, text: payload.body, author: a.owner?.name ?? 'Koios',
      created_at: new Date().toISOString(), ago: t('common:justNow', { defaultValue: 'zojuist' }) }
    setNotes(prev => [local, ...prev])
    if (a.id != null) api.post(`/applications/${a.id}/notes`, payload).catch(() => { /* keep optimistic entry */ })
  }

  return (
    <SharedNotesTab
      notes={notes}
      onAddNote={addNote}
      noteTypes={noteTypes}
      authorInitials={initials}
     
      showTimeline={false}
      showConversations={false}
      labels={{
        notes: t('notes.title'),
        newNote: t('notes.new'),
        type: t('notes.type'),
        save: t('notes.save'),
        cancel: t('notes.cancel'),
        notesEmpty: t('notes.empty'),
        notePlaceholder: () => t('notes.placeholder'),
      }}
    />
  )
}
