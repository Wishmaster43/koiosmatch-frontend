/**
 * MergeContactModal — absorb a duplicate contact person into a survivor. Thin
 * wrapper around the shared MergeEntityModal (picking UI + survivor flow); this
 * file only owns the contact-specific request shape and row mapping.
 *
 * TWO DELIBERATE DEVIATIONS from the candidate merge, both forced by the backend:
 *
 * 1. THE ROUTE DIRECTION IS INVERTED. The candidate route is
 *    POST /candidates/{SURVIVOR}/merge { source_id }, so the path id is the winner.
 *    The contact route is POST /customers/{customerId}/contacts/{DUPLICATE}/merge
 *    { target_contact_id }, so the path id is the LOSER and the body names the winner
 *    (CustomerContactController::merge — "merge this DUPLICATE contact ({id}) INTO the
 *    target"). Copying the candidate call shape here would delete the wrong person.
 *
 * 2. NO SEARCH ENDPOINT, AND THAT IS THE POINT. The duplicate is chosen from the
 *    customer's OWN already-loaded contact list, filtered in memory. The route is scoped
 *    to one customer and the backend resolves BOTH ids through that customer (a foreign
 *    id is a 404), so offering a tenant-wide search would only ever produce failures.
 *    Merging across customers is structurally unreachable from this UI.
 *
 * Merging is destructive and irreversible, so it names both people, states plainly what
 * disappears, and is permission-gated by the caller (customers.update — the backend
 * re-checks; §7).
 */
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifySuccess } from '@/lib/notify'
import { CONTACTS_CHANGED_EVENT } from '../hooks/useCustomerContacts'
import { contactOptionLabel } from '@/lib/contactLabel'
import type { Contact } from '@/types/customer'
import type { Id } from '@/types/common'
import MergeEntityModal, { type MergeCandidateRow } from './MergeEntityModal'

// Only the fields the shared picker rows/survivor control ever show — never
// the whole contact record (§8). `optionLabel` (contactOptionLabel, "Name —
// Function") keeps same-named contacts distinguishable, mirroring every other
// contact picker's label.
const toRow = (c: Contact): MergeCandidateRow => ({
  id: c.id as Id,
  name: c.name,
  optionLabel: contactOptionLabel(c),
  code: c.referenceNumber || undefined,
  email: c.email || undefined,
})

export default function MergeContactModal({ customerId, current, others, onClose, onMerged }: {
  /** Scopes the route; both contacts are resolved through THIS customer server-side. */
  customerId: Id
  current: Contact
  /** The customer's other contacts — the only merge candidates that can exist. */
  others: Contact[]
  onClose: () => void
  onMerged: (survivorId: Id) => void
}) {
  const { t } = useTranslation('customers')

  // The DUPLICATE goes in the path, the SURVIVOR in the body — inverted from
  // the candidate route (docblock deviation 1); getting this backwards deletes
  // the record the recruiter chose to keep.
  const mergeRequest = async (duplicateId: Id, survivorId: Id) => {
    await api.post(`/customers/${customerId}/contacts/${duplicateId}/merge`, { target_contact_id: survivorId })
    // The list this modal was opened from now holds a row that no longer exists —
    // tell the hook that owns it to refetch (see CONTACTS_CHANGED_EVENT).
    window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED_EVENT))
    notifySuccess(t('contacts.merge.done'))
  }

  return (
    <MergeEntityModal
      i18nPrefix="contacts.merge"
      persistKey="customer-merge-contact"
      current={toRow(current)}
      others={others.map(toRow)}
      onClose={onClose}
      onMerged={onMerged}
      mergeRequest={mergeRequest}
    />
  )
}
