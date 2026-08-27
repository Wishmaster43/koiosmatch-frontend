import { useTranslation } from 'react-i18next'
import SharedNotesTab from '@/components/drawer/tabs/NotesTab'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useApplicationNotes } from '../hooks/useApplicationNotes'
import type { ApplicationDetail } from '@/types/application'

/**
 * NotesTab — internal notes for an application. Reuses the shared NotesTab so it
 * looks exactly like the candidate drawer (rich-text composer, type chips, note
 * cards); timeline/conversations are hidden here (the drawer has its own tabs).
 * All state/persistence logic lives in useApplicationNotes (§3 — components stay
 * declarative); this file only wires the hook to the shared UI's props/labels.
 *
 * A-popout-1: passes `popout` so the composer can hand a half-typed note over to
 * the second-screen window (mirrors vacancies/customers), AND wires `onEditNote`
 * — PATCH (updateNote) and DELETE (destroyNote, CMBE 1049413a) both exist, so
 * a note can be edited and deleted right here in the drawer: full candidate
 * parity (NOTITIE-REFERENTIE, Danny 27-08).
 */
export default function NotesTab({ application: a }: { application: ApplicationDetail }) {
  const { t } = useTranslation('applications')
  // Note categories from the tenant lookup, scoped to 'application' (NOTE-TYPES-2/3).
  const { writableTypes: noteTypes } = useNoteTypes('application')
  const { notes, addNote, editNote, deleteNote } = useApplicationNotes(a.id, a.notes ?? [])

  // Fallback avatar for a note with no resolved author (mirrors the candidate
  // drawer's own fallback: CommunicationTab passes the CANDIDATE's owner
  // initials, not the current viewer — this is a generic per-entity default,
  // not a claim about who wrote a given note).
  const initials = (a.owner?.name ?? 'Koios').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

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
      popout={a.id ? { entity: 'application', id: String(a.id) } : undefined}
      labels={{
        notes: t('notes.title'),
        newNote: t('notes.new'),
        type: t('notes.type'),
        save: t('notes.save'),
        cancel: t('notes.cancel'),
        // applications.json (sister-agent namespace, reuse-only) has no dedicated
        // `notes.edit` key — mirrors ApplicationNotesPopout.tsx, which already
        // reuses this same generic key for the identical pencil label.
        edit: t('common:edit'),
        deleteNote: t('notes.deleteNote'),
        deleteConfirm: t('notes.deleteConfirm'),
        notesEmpty: t('notes.empty'),
        notePlaceholder: () => t('notes.placeholder'),
        searchPlaceholder: t('notes.searchPlaceholder'),
      }}
    />
  )
}
