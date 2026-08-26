/**
 * NotesTab — internal notes on a task (NT-TASK-1). Mirrors matches' NotesTab
 * onto the SAME shared NotesTab family (TaskCommentController validates `type`
 * against the entity=task note_types scope). The Reacties/comments thread tab
 * was removed 2026-07-14 for being an empty stub; this reinstates the surface
 * as a proper note-type-aware notes tab instead of the old plain-text thread.
 * A task's detail model (TaskDetail) carries no preloaded notes array, so this
 * tab fetches its own list once per task (GET /tasks/{id}/notes). The
 * fetch/optimistic-add/retry machinery is the SHARED `useEntityNotes` hook
 * (NOTES-TWINS-1, §11) — identical to the match tab.
 */
import { useTranslation } from 'react-i18next'
import SharedNotesTab from '@/components/drawer/tabs/NotesTab'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useEntityNotes } from '@/hooks/useEntityNotes'
import type { TaskDetail } from '@/types/task'

export default function NotesTab({ task }: { task: TaskDetail }) {
  const { t } = useTranslation('tasks')
  // Note categories from the tenant lookup, scoped to 'task' (NOTE-TYPES-2/3).
  const { writableTypes: noteTypes } = useNoteTypes('task')
  // Author avatar initials — the task's owner, else a Koios fallback.
  const authorName = task.owner?.name || 'Koios'
  const { notes, loading, error, fetchNotes, addNote } = useEntityNotes({ id: task.id, basePath: `/tasks/${task.id}`, authorName })
  const initials = authorName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

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
        searchPlaceholder: t('notes.searchPlaceholder'),
        loadError: t('notes.loadError'),
        retry: t('common:error.retry'),
      }}
    />
  )
}
