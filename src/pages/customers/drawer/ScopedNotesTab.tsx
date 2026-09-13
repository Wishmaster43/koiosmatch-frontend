/**
 * ScopedNotesTab — the location/department drill-down's OWN Notities sub-tab
 * (NOTES-LOC-DEPT-1). Thin wrapper using the shared useNotesTabContent hook with
 * location/department-scoped configuration: the level is already fixed by which
 * tab you are on, so there is no "gekoppeld aan" picker here — every note composed
 * on this tab is pinned to THIS location/department id, one POST field, never a
 * choice. Reuses the shared components/drawer/tabs/NotesTab the exact same way
 * ContactNotesTab does (§11 — one notes surface family, never a fork); no
 * timeline/conversations section here (this level has neither yet). Note-type
 * vocabulary resolution stays here (own useNoteTypesFor call, DRY round 10,
 * CUSTTABS) so this tab fires exactly the one widened note-types request it
 * always did.
 */
import { useTranslation } from 'react-i18next'
import { useNotesTabContent } from '@/hooks/useNotesTabContent'
import { useNoteTypesFor } from '@/lib/useNoteTypes'
import type { NoteTypeEntity } from '@/lib/useNoteTypes'
import NotesTabBody from './NotesTabBody'
import { useScopedCustomerNotes } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'

// Location/department-scoped notes tab: every note is pinned to this exact scope id.
export default function ScopedNotesTab({ scope, id, customerId }: {
  scope: 'location' | 'department'
  id: Id
  customerId?: Id
}) {
  const { t } = useTranslation('customers')
  const { notes, loading, error, reload } = useScopedCustomerNotes(customerId, scope, id)

  // BUG-NOTE-SCOPE-1 (backend CustomerController::addNote/updateNote): a location
  // note accepts types scoped to ['customer','location']; a department note accepts
  // ['customer','location','department'] — a deeper link WIDENS the accepted set,
  // it never narrows it. useNoteTypesFor fetches and merges every entity in that
  // widened set so the composer offers, and historical notes correctly resolve,
  // the full accepted vocabulary (NOTE-TYPE-WIDEN-1).
  const scopeEntities: NoteTypeEntity[] = scope === 'department'
    ? ['customer', 'location', 'department']
    : ['customer', 'location']
  const { writableTypes: noteTypes, types: chipTypes } = useNoteTypesFor(scopeEntities)

  // Payload shape: location or department scope determines which field to send.
  const createPayloadFields = scope === 'location'
    ? { customer_location_id: id }
    : { customer_department_id: id }

  const { authorInitials, addNote, editNote, deleteNote } = useNotesTabContent({
    notes,
    reload,
    customerId,
    createPayloadFields,
    apiEndpoint: `/customers/${customerId}/notes`,
  })

  // K-288: the linked-notes feed (NOTITIE-DOORLINK-1) that used to render as a
  // sibling here moved to its own sub-tab on the host (LocationDetail/DepartmentDetail).
  return (
    <NotesTabBody loading={loading} error={error} errorKey="scopedList.loadError"
      notes={notes} addNote={addNote} editNote={editNote} deleteNote={deleteNote}
      customerId={customerId} noteTypes={noteTypes} chipTypes={chipTypes}
      authorInitials={authorInitials} t={t}
    />
  )
}
