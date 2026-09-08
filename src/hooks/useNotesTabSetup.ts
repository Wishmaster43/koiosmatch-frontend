/**
 * useNotesTabSetup — shared setup wiring for entity notes tabs (match, task).
 * Consolidates useTranslation + useNoteTypes + useEntityNotes + useAuth +
 * initialsOf boilerplate, one call per entity type.
 * AUTHOR-CURRENT-USER-1: useEntityNotes stamps the optimistic note with the CURRENT
 * logged-in user, and the avatar initials are that user's too — never the entity's owner.
 * NOTITIE-PARITEIT (Danny 27-08): matches and tasks both carry PATCH + DELETE note routes,
 * so edit and delete are wired for both.
 */
import { useTranslation } from 'react-i18next'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useEntityNotes } from '@/hooks/useEntityNotes'
import { useAuth } from '@/context/AuthContext'
import { initialsOf } from '@/lib/initials'
import type { TFunction } from 'i18next'

interface NotesTabSetup {
  t: TFunction<string, string>
  noteTypes: ReturnType<typeof useNoteTypes>['writableTypes']
  notes: ReturnType<typeof useEntityNotes>['notes']
  loading: ReturnType<typeof useEntityNotes>['loading']
  error: ReturnType<typeof useEntityNotes>['error']
  fetchNotes: ReturnType<typeof useEntityNotes>['fetchNotes']
  addNote: ReturnType<typeof useEntityNotes>['addNote']
  editNote: ReturnType<typeof useEntityNotes>['editNote']
  deleteNote: ReturnType<typeof useEntityNotes>['deleteNote']
  initials: string
}

// Wire up identical setup pattern for match and task notes tabs — resolves
// entity-scoped note types, entity notes (fetch/add/edit/delete), auth user,
// and author initials. Entity type ('match'|'task') determines the lookup scope
// and API path; ns is the i18n namespace ('matches'|'tasks').
export function useNotesTabSetup(
  entity: 'match' | 'task',
  id: string,
  basePath: string,
  ns: string
): NotesTabSetup {
  const { t } = useTranslation(ns)
  const { writableTypes: noteTypes } = useNoteTypes(entity)
  const { notes, loading, error, fetchNotes, addNote, editNote, deleteNote } = useEntityNotes({ id, basePath })
  const auth = useAuth()
  const initials = initialsOf(auth?.user?.name, 'Koios')

  return {
    t,
    noteTypes,
    notes,
    loading,
    error,
    fetchNotes,
    addNote,
    editNote,
    deleteNote,
    initials,
  }
}
