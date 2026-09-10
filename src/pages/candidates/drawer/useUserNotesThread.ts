/**
 * useUserNotesThread — splits a candidate's raw note thread into the user
 * notes shown in the Notities UI and the system notes rendered as Tijdlijn
 * events (Danny 2026-07-13: SYSTEM notes — status/phase changes, BE-written —
 * are EVENTS, not notes, and never belong in the Notities thread, neither in
 * CommunicationTab's own tab nor in the second-screen CandidateNotesPopout
 * window). Keeps the original full-thread index on every note so an edit/
 * delete/undo call still hits the right row in the underlying
 * useCandidateNotes hook, which only ever indexes the FULL thread — NotesTab
 * hands back a FILTERED (user-only) index (DRY round 11, CANDTABS).
 */
import { SYSTEM_NOTE_TYPES } from '@/lib/useNoteTypes'
import type { TFunction } from 'i18next'
import type { CandidateNote } from '../hooks/useCandidateNotes'

// SYSTEM notes never belong in the Notities thread — see the module doc above.
function isSystemNote(n: CandidateNote): boolean {
  return Boolean(n.is_system) || SYSTEM_NOTE_TYPES.has(String(n.type ?? ''))
}

// One note payload shape, as NotesTab hands it back on add/edit.
type NotePayload = { type: string; title: string; body: string; channel?: string }

export function useUserNotesThread(notes: CandidateNote[], { editNote, deleteNote, fetchPreviousVersion, restorePreviousVersion }: {
  editNote: (index: number, payload: NotePayload) => unknown
  deleteNote: (index: number) => unknown
  fetchPreviousVersion?: (index: number) => unknown
  restorePreviousVersion?: (index: number) => unknown
}) {
  // Keep the original index on user notes so edits/deletes/undo still hit the
  // right row in the underlying full-thread hook.
  const indexed = notes.map((n, i) => ({ ...n, __idx: i }))
  const userNotes = indexed.filter(n => !isSystemNote(n))
  const systemNotes = indexed.filter(isSystemNote)
  const editUserNote = (fi: number, payload: NotePayload) => editNote(userNotes[fi].__idx, payload)
  // RECHTEN-NOTES-1: same filtered-index remap as edit — NotesTab hands the USER-list
  // index, the hook wants the full-thread index.
  const deleteUserNote = (fi: number) => deleteNote(userNotes[fi].__idx)
  // NOTE-UNDO-FE-1: same filtered-index remap as edit/delete above.
  const fetchUserPreviousVersion = fetchPreviousVersion ? (fi: number) => fetchPreviousVersion(userNotes[fi].__idx) : undefined
  const restoreUserPreviousVersion = restorePreviousVersion ? (fi: number) => restorePreviousVersion(userNotes[fi].__idx) : undefined
  return { userNotes, systemNotes, editUserNote, deleteUserNote, fetchUserPreviousVersion, restoreUserPreviousVersion }
}

/**
 * candidateNoteLabels — the NotesTab label subset shared by CommunicationTab's
 * Notities sub-tab and the second-screen CandidateNotesPopout window; each
 * caller spreads this and adds its own extra keys (timeline/conversations
 * labels, restore-previous, …). `t` is the caller's own candidates-namespace
 * translator (rule C: strings stay resolved by the consumer, never inside a
 * shared unit).
 */
export function candidateNoteLabels(t: TFunction) {
  return {
    // No section title (Danny addendum 4): notes/timeline/conversations each render
    // as the SOLE visible NotesTab section for their own sub-tab, whose bar already
    // carries that exact label — an in-content heading would just repeat it.
    notes: '',
    newNote: t('communication.newNote'),
    deleteNote: t('communication.deleteNote'), deleteConfirm: t('communication.deleteConfirm'),
    type: t('communication.type'),
    channel: t('communication.channel'),
    channelNone: t('communication.channelNone'),
    save: t('common:save'),
    cancel: t('common:cancel'),
    notesEmpty: t('sections.notesEmpty'),
    notePlaceholder: (typeLabel: string) => t('communication.notePlaceholder', { type: typeLabel }),
    searchPlaceholder: t('communication.searchPlaceholder'),
  }
}
