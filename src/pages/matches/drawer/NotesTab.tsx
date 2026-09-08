/**
 * NotesTab — internal notes on a match (NT-MATCH-1). Mirrors vacancies' NotesTab
 * onto the SAME shared NotesTab family (VacancyNoteController / MatchNoteController
 * both validate `type` against the entity-scoped note_types lookup). A match's list
 * row is detail-minimized (§8) and carries no notes array, unlike VacancyDetail/
 * ApplicationDetail — so this tab fetches its own list once per match
 * (GET /matches/{id}/notes) instead of reading a preloaded prop. The fetch/optimistic-add/
 * retry machinery is the SHARED `useEntityNotes` hook (NOTES-TWINS-1, §11) — identical
 * to the task tab. Rendering is shared via EntityNotesTab (NOTES-TWINS-2).
 */
import EntityNotesTab from '@/components/drawer/tabs/EntityNotesTab'
import type { MatchRow } from '@/types/match'

// Internal notes on a match (see file docblock above): fetches its own list on
// mount (a match row carries no preloaded notes) and renders through the shared
// EntityNotesTab family.
export default function NotesTab({ match: m }: { match: MatchRow }) {
  return <EntityNotesTab entity="match" id={String(m.id)} basePath={`/matches/${m.id}`} ns="matches" />
}
