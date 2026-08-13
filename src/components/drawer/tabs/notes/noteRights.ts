/**
 * noteRights — who may edit ONE note, and what counts as a backend-written event.
 *
 * Lifted out of NotesTab when the per-note second-screen editor
 * (NOTITIE-POPOUT-URL-1, Danny 11-08 "zet het notitie-id in de URL") had to apply
 * the SAME gate on its own route. A URL is pasteable and shareable, so that window
 * decides for itself whether the note it was pointed at may be edited there — and
 * it must decide it exactly like the list does, or one surface offers a pencil the
 * other refuses. One rule, two callers (§11: the helper landed WITH adoption).
 */
import { SYSTEM_NOTE_TYPES } from '@/lib/useNoteTypes'
import type { NoteItem } from '../NotesTab'

// A backend-written status/phase event, never a user note: no edit, no delete, no
// second screen — it records what happened, it is not text someone wrote.
export const isSystemNote = (n: NoteItem) => Boolean(n.is_system) || SYSTEM_NOTE_TYPES.has(String(n.type ?? ''))

/**
 * RECHTEN-DETAIL-1, mirroring the backend's own 403 rule: a note is manageable by
 * its author, or by a user holding `managePermission`. `author_id === undefined`
 * (the KEY absent) means the host has not migrated to this rights model at all —
 * unrestricted, exactly as before; an explicit `null` is a legacy/system note that
 * IS gated. UI gate only — the backend re-checks every write (§7).
 */
export function canManageNote(
  note: NoteItem,
  currentUserId: string | number | null | undefined,
  hasPermission: (permission: string) => boolean,
  managePermission: string,
): boolean {
  if (note.author_id === undefined) return true
  const isOwn = note.author_id !== null && currentUserId != null && String(note.author_id) === String(currentUserId)
  return isOwn || hasPermission(managePermission)
}
