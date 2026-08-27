/**
 * ContactNotesTab — the contactpersoon drill-down's OWN Notities sub-tab
 * (CONTACT-NOTITIES-2). Mirrors ScopedNotesTab's shape exactly (thin wrapper
 * around the shared components/drawer/tabs/NotesTab, fed by its own scoped
 * fetch) — the only difference is the read path: there is no dedicated scoped
 * notes endpoint for a contact, so useContactNotes filters the customer's own
 * GET /customers/{id}/notes client-side on customer_contact_id (see that
 * hook's own docblock). The type vocabulary is entity='contact' (CustomerController
 * ::addNote validates `type` against entity=contact whenever customer_contact_id
 * is filled — NOTE-TYPES-3-GAP-1), mirroring CustomerNotesTab's own contact-scope
 * branch rather than the location/department 'customer' scope ScopedNotesTab uses.
 */
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import NotesTabJs from '@/components/drawer/tabs/NotesTab'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { initialsOf } from '@/lib/initials'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useAuth } from '@/context/AuthContext'
import { useContactNotes } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
// Still-untyped JS UI helper — accept any props at the boundary (mirrors ScopedNotesTab).
const NotesTab = NotesTabJs as unknown as ComponentType<AnyProps>

// Thin wrapper around the shared NotesTab (see the module doc above): the read path filters the customer's own notes client-side since a contact has no dedicated scoped-notes endpoint.
export default function ContactNotesTab({ contactId, customerId }: {
  contactId: Id
  customerId?: Id
}) {
  const { t } = useTranslation('customers')
  const auth = useAuth()
  const authorInitials = initialsOf(auth?.user?.name ?? '')
  // Contact-level notes validate against entity='contact' (see file header) — never
  // the customer's own 'customer' vocabulary.
  const { writableTypes: noteTypes, types: chipTypes } = useNoteTypes('contact')
  const { notes, loading, error, reload } = useContactNotes(customerId, contactId)

  // Pinned to THIS contact — writes through the same endpoint the customer-level
  // composer uses (CustomerController::addNote), just with customer_contact_id preset.
  const addNote = (payload: { type: string; title: string; body: string; language?: string }) => {
    if (!customerId) return
    api.post(`/customers/${customerId}/notes`, {
      type: payload.type, title: payload.title, text: payload.body, language: payload.language,
      customer_contact_id: contactId,
    }).then(reload)
      .catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  }

  // NOTITIE-PARITEIT (Danny 27-08): same customer-level PATCH/DELETE routes
  // ScopedNotesTab uses — the note's id is scope-agnostic (see that file).
  const editNote = (noteId: Id | undefined, payload: { type: string; title: string; body: string; language?: string }) => {
    if (!customerId || noteId == null) return
    api.patch(`/customers/${customerId}/notes/${noteId}`, { type: payload.type, text: payload.body, language: payload.language })
      .then(reload)
      .catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  }
  const deleteNote = (noteId: Id | undefined) => {
    if (!customerId || noteId == null) return
    api.delete(`/customers/${customerId}/notes/${noteId}`)
      .then(reload)
      .catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  }

  // Four explicit UI states (§3) — never a blank screen while the scoped fetch is in flight or failed.
  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('page.loading')}</div>
  // Neutral copy: the shared scopedList.loadError names a LOCATION, untrue here.
  if (error) return <div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('scopedList.loadErrorGeneric')}</div>

  return (
    <NotesTab
      notes={notes} onAddNote={addNote}
      popout={customerId ? { entity: 'customer', id: customerId } : undefined}
      onEditNote={(i: number, payload: { type: string; title: string; body: string; language?: string }) => editNote(notes[i]?.id as Id | undefined, payload)}
      onDeleteNote={(i: number) => deleteNote(notes[i]?.id as Id | undefined)}
      noteTypes={noteTypes} chipTypes={chipTypes}
      authorInitials={authorInitials}
      showTimeline={false} showConversations={false}
      labels={{
        notes: t('notes.notes'), newNote: t('notes.newNote'), type: t('notes.type'),
        save: t('notes.save'), cancel: t('notes.cancel'), edit: t('notes.edit'),
        notesEmpty: t('notes.notesEmpty'),
        notePlaceholder: () => t('notes.notePlaceholder'),
        searchPlaceholder: t('notes.searchPlaceholder'),
        deleteNote: t('notes.deleteNote'), deleteConfirm: t('notes.deleteConfirm'),
      }}
    />
  )
}
