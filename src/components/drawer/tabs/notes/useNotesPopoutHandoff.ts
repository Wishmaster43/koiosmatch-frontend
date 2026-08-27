/**
 * useNotesPopoutHandoff — NOTITIE-POPOUT-HANDOFF-1 / -EDIT-1 / -URL-1: owns the
 * second-screen wiring for the notes tab — handing the composer's half-typed
 * draft over, handing ONE existing note over to be edited there, and (when
 * this render IS that window) taking either over. Pulled out of NotesTab.tsx
 * (§3 hard cap — the file crossed its 400-line split trigger). The protocol
 * itself still lives in `hooks/useNotesPopout`; this hook only binds it to the
 * tab's own composer state (adding/editingIdx) and note list.
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNotesPopout } from '@/hooks/useNotesPopout'
import type { NotesPopoutTarget } from '@/hooks/useNotesPopout'
import { notifyError } from '@/lib/notify'
import { openNoteEditPopout } from '@/lib/secondScreen'
import type { NoteItem, NotePayload } from '../NotesTab'

interface Options {
  popout?: NotesPopoutTarget
  notes: NoteItem[]
  adding: boolean
  editingIdx: number | null
  setAdding: (v: boolean) => void
  setEditingIdx: (v: number | null) => void
  onEditNote?: (i: number, payload: NotePayload) => void
  // A note's stable id — the only thing an edit handoff carries across windows.
  noteIdOf: (n: NoteItem) => string | null
}

// Binds the popout handoff protocol to this tab's own composer state; returns
// everything the container needs to render the pop-out affordances and to
// seed/close the composer from an incoming handoff.
export function useNotesPopoutHandoff({ popout, notes, adding, editingIdx, setAdding, setEditingIdx, onEditNote, noteIdOf }: Options) {
  const { t } = useTranslation('common')
  // Second screen: handing the composer's half-typed note over, handing ONE
  // existing note over to be edited there, and — when this render IS that
  // window — taking either over. Only a DRAFT handoff closes the composer
  // here: an edit handoff left the note in the list untouched, so closing on
  // its ack would throw away whatever else the recruiter happened to have open.
  const { isWindow: isPopoutWindow, handOff, canHandOffNote, pending: handoffPending, incoming, incomingNoteId, ack, clearIncoming } =
    useNotesPopout({ target: popout, onHandedOver: kind => { if (kind === 'draft') { setAdding(false); setEditingIdx(null) } } })
  // A handed-over draft is only taken over while THIS composer is free: overwriting
  // a note being written here would just move the text loss elsewhere. Not taken
  // over = never acked = the drill-down keeps its own text (see the hook).
  const incomingDraft = adding ? null : incoming
  // Ack from an EFFECT, i.e. after the render that actually shows the draft — the
  // other window may close only once this one demonstrably holds the text.
  useEffect(() => { if (incomingDraft) ack() }, [incomingDraft, ack])
  // Window side (NOTITIE-POPOUT-EDIT-1): the drill-down asked this window to open
  // ONE existing note in its editor. Resolved against the thread THIS window
  // loaded — never against anything the sender sent — and only while this composer
  // is free, so a note being written here is never overwritten. Not found (thread
  // still loading, note outside this window's scope) = index -1 = nothing happens
  // and nothing is acked, which is what keeps the drill-down honest.
  const incomingEditIdx = incomingNoteId != null && !adding
    ? notes.findIndex(n => noteIdOf(n) === incomingNoteId)
    : -1
  // Once incomingEditIdx resolves to a real note, switch the composer into edit mode for it.
  useEffect(() => {
    if (incomingEditIdx < 0) return
    setEditingIdx(incomingEditIdx)
    setAdding(true)
  }, [incomingEditIdx, setEditingIdx, setAdding])
  // Confirm ONLY from a render where the composer really holds that exact note —
  // acking on the request alone would tell the drill-down the note is being edited
  // here while this window never found it.
  useEffect(() => {
    const shown = editingIdx == null ? undefined : notes[editingIdx]
    if (incomingNoteId == null || !adding || !shown) return
    if (noteIdOf(shown) !== incomingNoteId) return
    ack()
  }, [incomingNoteId, adding, editingIdx, notes, ack, noteIdOf])
  // Per-note second-screen affordance (NOTITIE-POPOUT-EDIT-1): only where the
  // receiving window can actually PATCH the note (canHandOffNote) AND this surface
  // edits notes at all — the icon sits in the pencil's group and must never promise
  // more than the pencil does.
  const canPopOutNote = canHandOffNote && Boolean(onEditNote)
  // NOTITIE-POPOUT-URL-1 (live 13-08 "zoals de profieltekst"): the row icon opens
  // the note's OWN window by URL — no channel handoff, no race, no pending state.
  const openNoteWindow = (noteId: string) => {
    if (!popout) return
    if (!openNoteEditPopout(popout.entity, popout.id, noteId)) notifyError(t('popupBlocked'))
  }
  return { isPopoutWindow, handOff, handoffPending, incomingDraft, clearIncoming, canPopOutNote, openNoteWindow }
}
