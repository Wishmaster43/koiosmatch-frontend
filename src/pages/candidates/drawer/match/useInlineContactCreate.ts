/**
 * useInlineContactCreate — the "+ Match" form's inline new-contact create
 * (Danny): when a customer has no matching contact, add one and couple it to
 * the picked location right here (POST /customers/{id}/contacts). Split out
 * of useMatchForm (§3 size split, over the ~400-line trigger) — a self-
 * contained concern: the draft fields, the client-side duplicate-contact
 * preflight (the backend enforces no such uniqueness) and the create call.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { findDuplicateContact } from './helpers'
import type { CascadeOption } from '@/hooks/useCustomerCascade'
import type { Id } from '@/types/common'

// Owns the inline new-contact draft + its create call; the caller supplies the
// cascade it must couple into (customer/location/contacts) and how to select
// the created contact once it lands.
export function useInlineContactCreate({
  customerId, locationId, contacts, refetchCustomer, setContactId,
}: {
  customerId: string
  locationId: string
  contacts: CascadeOption[]
  refetchCustomer: () => Promise<unknown>
  setContactId: (v: string) => void
}) {
  const { t } = useTranslation(['candidates', 'common'])
  const [creatingContact, setCreatingContact] = useState(false)
  // function/phone/mobile (Danny 24-07 addendum) are all accepted by the backend's
  // CustomerContactController::validateContact — verified directly against the
  // koiosmatch-api source, never assumed.
  const [nc, setNc] = useState({ first_name: '', last_name: '', email: '', phone: '', mobile: '', function: '' })
  // Duplicate-contact preflight result (Danny 24-07): set by saveContact() below
  // when the entered email/phone/mobile already matches a contact already loaded
  // for this customer; null once cleared (cancel, or a fresh non-duplicate attempt).
  const [duplicateContact, setDuplicateContact] = useState<CascadeOption | null>(null)

  // Create a contact for the current customer, coupled to the picked location, then
  // refetch the cascade (shared hook) and select the new contact.
  const saveContact = async () => {
    if (!customerId || !nc.first_name.trim() || !nc.last_name.trim()) return
    // Duplicate preflight (Danny 24-07): block BEFORE posting when the email or
    // either phone number already belongs to a contact already loaded for this
    // customer — the backend does NOT enforce this uniqueness itself (verified:
    // CustomerContactController::validateContact carries no unique: rule on
    // email/phone/mobile, a real gap worth a backend ticket), so the FE is the
    // only guard against creating a second record for the same person.
    const dup = findDuplicateContact(nc, contacts)
    if (dup) { setDuplicateContact(dup); return }
    setDuplicateContact(null)
    try {
      // customer_location_id (NOT location_id — a silent-drop bug found while
      // verifying the backend contract: CustomerContact's fillable/validated key
      // is customer_location_id; the old `location_id` key was never recognised
      // by CustomerContactController::validateContact, so the picked location
      // never actually reached a newly created inline contact).
      const r = await api.post(`/customers/${customerId}/contacts`, { ...nc, customer_location_id: locationId || undefined })
      const created = (unwrap(r)) as { id?: Id }
      await refetchCustomer()
      if (created?.id) setContactId(String(created.id))
      setCreatingContact(false); setNc({ first_name: '', last_name: '', email: '', phone: '', mobile: '', function: '' })
      notifySuccess(t('placement.contactCreated'))
    } catch {
      notifyError(t('placement.contactFailed'))
    }
  }

  return { creatingContact, setCreatingContact, nc, setNc, saveContact, duplicateContact, setDuplicateContact }
}
