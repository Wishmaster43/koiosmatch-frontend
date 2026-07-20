import { useTranslation } from 'react-i18next'
import SharedNotesTab from '@/components/drawer/tabs/NotesTab'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useOpportunityNotes } from '../hooks/useOpportunityNotes'
import type { Opportunity } from '@/types/opportunity'

// Rich-text editor tooltips (mirror the candidate/application drawer).
/**
 * NotesTab — internal notes for an opportunity. Reuses the shared NotesTab so it
 * looks exactly like the candidate drawer; data via /opportunities/{id}/notes (C-41).
 */
export default function NotesTab({ opportunity: o }: { opportunity: Opportunity }) {
  const { t } = useTranslation(['opportunities', 'common'])
  // Note categories from the tenant lookup, scoped to 'opportunity' (NOTE-TYPES-2/3).
  const { writableTypes: noteTypes } = useNoteTypes('opportunity')
  const { items: notes, addNote } = useOpportunityNotes(o?.id)

  return (
    <SharedNotesTab
      notes={notes}
      onAddNote={(p: { type: string; body: string }) => addNote({ type: p.type, body: p.body })}
      noteTypes={noteTypes}
     
      showTimeline={false}
      showConversations={false}
      labels={{
        notes: t('notes.title'),
        newNote: t('notes.new'),
        type: t('notes.type'),
        save: t('common:save'),
        cancel: t('common:cancel'),
        notesEmpty: t('notes.empty'),
        notePlaceholder: () => t('notes.placeholder'),
      }}
    />
  )
}
