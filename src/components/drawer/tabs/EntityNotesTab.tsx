/**
 * EntityNotesTab — shared notes tab renderer for match and task (NOTES-TWINS-2).
 * Eliminates duplicate loading + SharedNotesTab call across the two entity tabs
 * (pages/matches/drawer/NotesTab.tsx and pages/tasks/drawer/NotesTab.tsx). The
 * setup machinery (useNotesTabSetup) already consolidates fetch/add/edit/delete
 * boilerplate; this component consolidates the identical render pattern.
 */
import SharedNotesTab from '@/components/drawer/tabs/NotesTab'
import { useNotesTabSetup } from '@/hooks/useNotesTabSetup'

interface EntityNotesTabProps {
  entity: 'match' | 'task'
  id: string
  basePath: string
  ns: string
}

// Render the shared notes tab with the four UI states (loading/error/empty/success)
// for match and task entities — identical render of the current match and task tabs.
export default function EntityNotesTab({ entity, id, basePath, ns }: EntityNotesTabProps) {
  const { t, noteTypes, notes, loading, error, fetchNotes, addNote, editNote, deleteNote, initials } = useNotesTabSetup(entity, id, basePath, ns)

  // Four UI states (§3): loading / error+retry (rendered by the SHARED tab, 04-08 —
  // `fetchNotes` doubles as the retry action) / empty (the shared tab's own
  // "notesEmpty" copy) / success.
  if (loading) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 2px' }}>{t('notes.loading')}</div>
  }

  return (
    <SharedNotesTab
      notes={notes}
      error={error}
      onRetry={fetchNotes}
      onAddNote={addNote}
      onEditNote={editNote}
      onDeleteNote={deleteNote}
      noteTypes={noteTypes}
      authorInitials={initials}
      showTimeline={false}
      showConversations={false}
      // POPOUT-PARITEIT-1: which record the shared tab may pop out — full
      // parity with candidate/application/vacancy since both PATCH and DELETE
      // routes exist for both match and task notes.
      popout={{ entity, id }}
      labels={{
        notes: t('notes.title'),
        newNote: t('notes.new'),
        type: t('notes.type'),
        save: t('notes.save'),
        cancel: t('notes.cancel'),
        notesEmpty: t('notes.empty'),
        notePlaceholder: () => t('notes.placeholder'),
        searchPlaceholder: t('notes.searchPlaceholder'),
        loadError: t('notes.loadError'),
        retry: t('common:error.retry'),
        edit: t('notes.edit'),
        deleteNote: t('notes.deleteNote'),
        deleteConfirm: t('notes.deleteConfirm'),
      }}
    />
  )
}
