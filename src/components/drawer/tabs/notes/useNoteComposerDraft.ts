/**
 * useNoteComposerDraft — owns the notes composer's concept/draft lifecycle:
 * the session+durable CONCEPT-NOTE-1/K-161 draft, closing the composer, and
 * the add-vs-edit save + delete-confirm plumbing. Extracted out of NotesTab
 * (§3 split, K-SIZE-SPLIT-A); behaviour is unchanged.
 */
import { useEffect, useState } from 'react'
import type { NoteDraft } from '@/hooks/useNotesPopout'
import { getNoteDraft, putNoteDraft, deleteNoteDraft } from './noteDraftApi'
import type { NoteDraftEntityType } from './noteDraftApi'
import type { NotePayload } from '../NotesTab'
import type { useConfirm } from '@/hooks/useConfirm'

interface UseNoteComposerDraftArgs {
  draftEntity?: { type: NoteDraftEntityType; id: string }
  editingIdx: number | null
  setAdding: (v: boolean) => void
  setEditingIdx: (v: number | null) => void
  clearIncoming: () => void
  onAddNote?: (payload: NotePayload) => void
  onEditNote?: (i: number, payload: NotePayload) => void
  onDeleteNote?: (i: number) => void
  confirm: ReturnType<typeof useConfirm>['confirm']
  deleteConfirmLabel?: string
}

export function useNoteComposerDraft({
  draftEntity, editingIdx, setAdding, setEditingIdx, clearIncoming,
  onAddNote, onEditNote, onDeleteNote, confirm, deleteConfirmLabel,
}: UseNoteComposerDraftArgs) {
  // CONCEPT-NOTE-1 (Danny 24-08: "dismissing it and losing the text is not good —
  // save it as a concept"): a cancelled NEW note survives as a session concept
  // and seeds the next new-note open; a successful save clears it. Session
  // scope is deliberate — note text is special-category data (§8), so it never
  // touches localStorage; durable concepts are the CMBE follow-up.
  const [concept, setConcept] = useState<NoteDraft | null>(null)
  const draftType = draftEntity?.type
  const draftId = draftEntity?.id
  // Load any durable draft for this dossier once per draftType/draftId; a failed fetch simply keeps the session-only concept.
  useEffect(() => {
    if (!draftType || !draftId) return
    const ctrl = new AbortController()
    getNoteDraft(draftType, draftId, ctrl.signal)
      .then(stored => { if (stored) setConcept(prev => prev ?? stored) })
      .catch(() => { /* honest degrade: session-only */ })
    return () => ctrl.abort()
  }, [draftType, draftId])

  // Close the popup — NoteComposer owns its own field state, so this is just "not
  // composing anything" again. Dropping a received draft too, so a next note never re-seeds from it.
  const closeComposer = () => { setAdding(false); setEditingIdx(null); clearIncoming() }
  // NoteComposer hands back the finished payload; this is the only place that
  // still decides add-vs-edit (the index into the FULL `notes` array).
  const handleSaveConcept = (draft: NoteDraft | null) => {
    setConcept(draft)
    if (!draftEntity) return
    if (draft) putNoteDraft(draftEntity.type, draftEntity.id, draft).catch(() => { /* session concept still holds */ })
    else deleteNoteDraft(draftEntity.type, draftEntity.id).catch(() => { /* stale server draft is cleaned up server-side after 30 days */ })
  }
  // Finalizes a note save (add or edit): clears the concept/draft, applies the add-vs-edit branch, then closes the composer.
  const handleSave = (payload: NotePayload) => {
    setConcept(null)
    if (draftEntity) deleteNoteDraft(draftEntity.type, draftEntity.id).catch(() => { /* server cleanup catches strays */ })
    if (editingIdx == null) onAddNote?.(payload)
    else onEditNote?.(editingIdx, payload)
    closeComposer()
  }
  // Delete — staged behind the shared confirm dialog; index mirrors openEdit/onEditNote.
  const requestDelete = (i: number) => confirm(deleteConfirmLabel ?? '', () => onDeleteNote?.(i), { danger: true })

  return { concept, closeComposer, handleSaveConcept, handleSave, requestDelete }
}
