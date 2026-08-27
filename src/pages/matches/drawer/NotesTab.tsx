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
import { useTranslation } from 'react-i18next'
import SharedNotesTab from '@/components/drawer/tabs/NotesTab'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useEntityNotes } from '@/hooks/useEntityNotes'
import { useAuth } from '@/context/AuthContext'
import type { MatchRow } from '@/types/match'

// Internal notes on a match (see file docblock above): fetches its own list on
// mount (a match row carries no preloaded notes) and renders through the shared
// NotesTab family.
export default function NotesTab({ match: m }: { match: MatchRow }) {
  const { t } = useTranslation('matches')
  // Note categories from the tenant lookup, scoped to 'match' (NOTE-TYPES-2/3).
  const { writableTypes: noteTypes } = useNoteTypes('match')
  // NOTITIE-PARITEIT (Danny 27-08): matches/{match}/notes/{note} has a DELETE
  // route (MatchNoteController::destroy) but NO update route — wire delete
  // only; an edit pencil would call a PATCH the backend does not expose.
  // AUTHOR-CURRENT-USER-1: useEntityNotes stamps the optimistic note with the
  // CURRENT logged-in user itself (see the hook) — the match's owner is a
  // different person entirely and must not be passed in.
  // PATCH landed with CMBE 1049413a (MatchNoteController::update) — full parity.
  const { notes, loading, error, fetchNotes, addNote, editNote, deleteNote } = useEntityNotes({ id: m.id, basePath: `/matches/${m.id}` })
  // Author avatar initials — the current user composing the note, not the match's owner.
  const auth = useAuth()
  const initials = (auth?.user?.name || 'Koios').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

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
