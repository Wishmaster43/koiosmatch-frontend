/**
 * useContactPrimaryPromotion — split out of ContactsPanel (§3 mechanical split, file
 * pushed past ~400 lines). Owns the "make primary here" mutation only: which row's PUT
 * is in flight (CONTACT-LOCATION-PRIMARY-1) and the promote action itself, so a double
 * click cannot race two promotions at the same site.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { notifyError, notifySuccess } from '@/lib/notify'
import { setLocationPrimaryContact } from '../hooks/useCustomerContacts'
import type { Contact } from '@/types/customer'
import type { Id } from '@/types/common'

/**
 * Promote this contact to the primary contact OF THIS LOCATION. It demotes the previous
 * primary of THIS SITE only; the customer's own main contact (`isPrimary`) is a
 * different field and is left alone. There is deliberately no "unset" — the backend has
 * no route for it, so the flag moves by promoting someone else instead of by a toggle
 * with nothing behind it. The owning hook refetches via CONTACTS_CHANGED_EVENT.
 */
export function useContactPrimaryPromotion(locationScope: boolean, scopeId: Id | undefined) {
  const { t } = useTranslation('customers')
  const [promoting, setPromoting] = useState<Id | null>(null)

  const promote = async (c: Contact) => {
    if (!locationScope || c.id == null || c.customerId == null || promoting != null) return
    setPromoting(c.id)
    try {
      const applied = await setLocationPrimaryContact(c.customerId, c.id, scopeId as Id)
      // A 200 that did not move the flag is still a failure for the user (the pivot column
      // is not on this tenant database yet) — say so instead of showing a silent no-op.
      if (applied) notifySuccess(t('locations.detail.setPrimaryContactDone', { name: c.name }))
      else notifyError(t('locations.detail.setPrimaryContactUnavailable'))
    } catch {
      notifyError(t('locations.detail.setPrimaryContactFailed'))
    } finally {
      setPromoting(null)
    }
  }

  return { promoting, promote }
}
