/**
 * NotesTab — internal notes on a match (NT-MATCH-1). Mirrors vacancies'
 * NotesTab onto the SAME shared NotesTab family (VacancyNoteController /
 * MatchNoteController both validate `type` against the entity-scoped
 * note_types lookup). A match's list row is detail-minimized (§8) and carries
 * no notes array, unlike VacancyDetail/ApplicationDetail — so this tab fetches
 * its own list once per match (GET /matches/{id}/notes) instead of reading a
 * preloaded prop. The fetch/optimistic-add/retry machinery is the SHARED
 * `useEntityNotes` hook (NOTES-TWINS-1, §11) — identical to the task tab.
 */
import SharedNotesTab from '@/components/drawer/tabs/NotesTab'
import { useNotesTabSetup } from '@/hooks/useNotesTabSetup'
import type { MatchRow } from '@/types/match'

// Internal notes on a match (see file docblock above): fetches its own list on
// mount (a match row carries no preloaded notes) and renders through the shared
// NotesTab family.
export default function NotesTab({ match: m }: { match: MatchRow }) {
  const { t, noteTypes, notes, loading, error, fetchNotes, addNote, editNote, deleteNote, initials } = useNotesTabSetup('match', String(m.id), `/matches/${m.id}`, 'matches')

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
      // parity with candidate/application/vacancy since the PATCH route above
      // lands, so the per-note "edit on second screen" icon shows too.
      popout={{ entity: 'match', id: String(m.id) }}
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
