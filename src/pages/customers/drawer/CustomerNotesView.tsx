/**
 * CustomerNotesView — the shared NotesTab render + labels for the customer's
 * scoped notes tabs (contact/location/department), extracted from the
 * byte-identical block in ContactNotesTab and ScopedNotesTab (DRY round 11,
 * CUSTTABS2). Strings resolve through the CONSUMER's own customers-namespace
 * `t` (rule C) — this file never imports useTranslation itself.
 */
import type { ComponentType } from 'react'
import type { TFunction } from 'i18next'
import NotesTabJs from '@/components/drawer/tabs/NotesTab'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
// Still-untyped JS UI helper — accept any props at the boundary.
const NotesTab = NotesTabJs as unknown as ComponentType<AnyProps>

// The shared NotesTab labels object, resolved by the caller's own t() (rule C).
// Module-private: CustomerNotesView is the only call site, so it is not exported.
function customerNoteLabels(t: TFunction) {
  return {
    notes: t('notes.notes'), newNote: t('notes.newNote'), type: t('notes.type'),
    save: t('notes.save'), cancel: t('notes.cancel'), edit: t('notes.edit'),
    notesEmpty: t('notes.notesEmpty'),
    notePlaceholder: () => t('notes.notePlaceholder'),
    searchPlaceholder: t('notes.searchPlaceholder'),
    deleteNote: t('notes.deleteNote'), deleteConfirm: t('notes.deleteConfirm'),
  }
}

interface CustomerNotesViewProps {
  notes: unknown[]
  addNote: (payload: { type: string; title: string; body: string; language?: string }) => void
  editNote: (index: number, payload: { type: string; title: string; body: string; language?: string }) => void
  deleteNote: (index: number) => void
  customerId?: Id
  noteTypes: unknown
  chipTypes: unknown
  authorInitials: string
  t: TFunction
}

// Renders the shared NotesTab with the customer-scoped wiring — byte-identical
// to the two former inline copies in ContactNotesTab/ScopedNotesTab.
export default function CustomerNotesView({ notes, addNote, editNote, deleteNote, customerId, noteTypes, chipTypes, authorInitials, t }: CustomerNotesViewProps) {
  return (
    <NotesTab
      notes={notes} onAddNote={addNote}
      popout={customerId ? { entity: 'customer', id: customerId } : undefined}
      onEditNote={(i: number, payload: { type: string; title: string; body: string; language?: string }) => editNote(i, payload)}
      onDeleteNote={(i: number) => deleteNote(i)}
      noteTypes={noteTypes} chipTypes={chipTypes}
      authorInitials={authorInitials}
      showTimeline={false} showConversations={false}
      labels={customerNoteLabels(t)}
    />
  )
}
