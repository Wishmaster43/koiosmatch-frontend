import type { Id } from './common'

export type NotePayload = { type: string; title: string; body: string; language?: string }

export interface CustomerNoteCallbacks {
  onAddNote?: (id: Id | undefined, payload: NotePayload) => void
  onEditNote?: (id: Id | undefined, noteId: Id | undefined, payload: NotePayload) => void
  onDeleteNote?: (id: Id | undefined, noteId: Id | undefined) => void
  onFetchPreviousVersion?: (id: Id | undefined, noteId: Id | undefined) => Promise<{ previous_body: string | null; previous_saved_at: string | null } | null>
  onRestorePreviousNote?: (id: Id | undefined, noteId: Id | undefined) => Promise<boolean>
}
