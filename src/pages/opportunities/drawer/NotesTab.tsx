/**
 * NotesTab — internal notes for an opportunity. Reuses the shared NotesTab so it
 * looks exactly like the candidate drawer; data via /opportunities/{id}/notes (C-41).
 * OPP-NOTE-EDIT-1 (G23): the edit pencil now really persists via PUT
 * /opportunities/{id}/notes/{note} (useOpportunityNotes.editNote) — the candidate
 * wiring (CommunicationTab → useCandidateNotes.editNote) is the reference.
 */
import { useTranslation } from 'react-i18next'
import SharedNotesTab from '@/components/drawer/tabs/NotesTab'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useOpportunityNotes } from '../hooks/useOpportunityNotes'
import type { Opportunity } from '@/types/opportunity'

// Wires opportunity notes into the shared NotesTab so it matches the candidate drawer exactly; data and edit/add persistence come from useOpportunityNotes (see file header).
export default function NotesTab({ opportunity: o }: { opportunity: Opportunity }) {
  const { t } = useTranslation(['opportunities', 'common'])
  // Note categories from the tenant lookup, scoped to 'opportunity' (NOTE-TYPES-2/3).
  const { writableTypes: noteTypes } = useNoteTypes('opportunity')
  const { items: notes, loading, error, addNote, editNote } = useOpportunityNotes(o?.id)

  // §3 (audit r4): loading/error render explicitly — a failed fetch must never
  // look like "no notes yet" (SharedNotesTab has no state props of its own).
  // Canon (05-08): 12px muted body text, matching the sibling drawers' loading/error copy.
  const muted = { fontSize: 12, color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' as const }
  if (loading) return <div style={muted}>{t('common:loading')}</div>
  if (error) return <div style={{ ...muted, color: 'var(--color-danger-text)' }}>{t('notes.loadError')}</div>

  return (
    <SharedNotesTab
      notes={notes}
      onAddNote={(p: { type: string; body: string; language?: string }) => addNote({ type: p.type, body: p.body, language: p.language })}
      // OPP-NOTE-EDIT-1: the index-keyed edit callback — see useOpportunityNotes.editNote.
      onEditNote={(i: number, p: { type: string; body: string; language?: string }) => editNote(i, { type: p.type, body: p.body, language: p.language })}
      noteTypes={noteTypes}
      showTimeline={false}
      showConversations={false}
      labels={{
        notes: t('notes.title'),
        newNote: t('notes.new'),
        type: t('notes.type'),
        save: t('common:save'),
        cancel: t('common:cancel'),
        edit: t('common:edit'),
        notesEmpty: t('notes.empty'),
        notePlaceholder: () => t('notes.placeholder'),
        searchPlaceholder: t('notes.searchPlaceholder'),
      }}
    />
  )
}
