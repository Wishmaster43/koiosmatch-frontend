/**
 * ContactNotesTab — the contactpersoon drill-down's OWN Notities sub-tab
 * (CONTACT-NOTITIES-2). Thin wrapper using the shared useNotesTabContent hook
 * with contact-scoped configuration (entity='contact', customer_contact_id payload).
 * The read path filters the customer's own GET /customers/{id}/notes client-side
 * on customer_contact_id (see useContactNotes hook's own docblock). The type
 * vocabulary is entity='contact' (CustomerController::addNote validates `type`
 * against entity=contact whenever customer_contact_id is filled —
 * NOTE-TYPES-3-GAP-1), mirroring CustomerNotesTab's own contact-scope branch
 * rather than the location/department 'customer' scope ScopedNotesTab uses; the
 * useNoteTypes('contact') call therefore stays HERE (DRY round 10, CUSTTABS), so
 * this tab fires exactly the one note-types request it always did.
 */
import { useTranslation } from 'react-i18next'
import { useNoteTypes } from '@/lib/useNoteTypes'
import { useNotesTabContent } from '@/hooks/useNotesTabContent'
import CustomerNotesView from './CustomerNotesView'
import { useContactNotes } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'

// Thin wrapper using the shared hook: read path filters customer's own notes
// client-side (no dedicated scoped endpoint for contacts), write path uses contact entity.
export default function ContactNotesTab({ contactId, customerId }: {
  contactId: Id
  customerId?: Id
}) {
  const { t } = useTranslation('customers')
  // Contact-level notes validate against entity='contact' — never the customer's own vocabulary.
  const { writableTypes: noteTypes, types: chipTypes } = useNoteTypes('contact')
  const { notes, loading, error, reload } = useContactNotes(customerId, contactId)
  const { authorInitials, addNote, editNote, deleteNote } = useNotesTabContent({
    notes,
    reload,
    customerId,
    createPayloadFields: { customer_contact_id: contactId },
    apiEndpoint: `/customers/${customerId}/notes`,
  })

  // Four explicit UI states (§3) — never a blank screen while the scoped fetch is in flight or failed.
  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('page.loading')}</div>
  // Neutral copy: the shared scopedList.loadError names a LOCATION, untrue here.
  if (error) return <div style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('scopedList.loadErrorGeneric')}</div>

  return (
    <CustomerNotesView
      notes={notes} addNote={addNote} editNote={editNote} deleteNote={deleteNote}
      customerId={customerId} noteTypes={noteTypes} chipTypes={chipTypes}
      authorInitials={authorInitials} t={t}
    />
  )
}
