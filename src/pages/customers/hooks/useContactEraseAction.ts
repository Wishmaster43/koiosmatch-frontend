/**
 * useContactEraseAction — ONIX K-005: the "Persoon wissen" dialog state + the
 * actual erase POST, extracted out of ContactDetail (§3 split trigger, file
 * passed ~430 lines) so the component only wires a button and a dialog.
 * SHARED-UNIT-TEST-1: own test asserts the route/body, the refresh broadcast
 * and the close callback.
 */
import { useState } from 'react'
import { eraseContact } from './useContactErase'
import { CONTACTS_CHANGED_EVENT } from './useCustomerContacts'
import { notifySuccess } from '@/lib/notify'
import type { Contact } from '@/types/customer'
import type { Id } from '@/types/common'

// Owns the open/closed state of the erase dialog and the confirm POST itself.
export function useContactEraseAction(contact: Contact, close: () => void, doneMessage: string) {
  const [erasing, setErasing] = useState(false)
  const open = () => setErasing(true)
  const cancel = () => setErasing(false)

  // Runs the actual POST on confirm; throws on failure (the dialog shows the
  // mapped message). Success re-broadcasts the contacts-changed event, the
  // same refresh signal merge/archive use, then closes this drawer.
  const confirm = async (password: string) => {
    if (contact.customerId == null) return
    await eraseContact(contact.customerId, contact.id as Id, password)
    notifySuccess(doneMessage)
    window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED_EVENT))
    setErasing(false)
    close()
  }

  return { erasing, open, cancel, confirm }
}
