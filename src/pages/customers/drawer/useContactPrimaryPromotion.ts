/**
 * useContactPrimaryPromotion — split out of ContactsPanel (§3 mechanical split, file
 * pushed past ~400 lines). Owns the "make primary here" mutation only: which row's PUT
 * is in flight (CONTACT-LOCATION-PRIMARY-1 / CONTACT-DEPARTMENT-PRIMARY-1) and the
 * promote action itself, so a double click cannot race two promotions at the same site.
 *
 * Generalized to the `ContactScope` discriminator ContactsPanel already threads
 * everywhere else (scope === 'location' | 'department' | 'customer'), rather than a
 * location-only boolean — the department pivot (customer_contact_customer_department.
 * is_primary) now has its own route, so this hook picks the matching API call and i18n
 * copy off the SAME scope value instead of forking into a second, near-identical hook.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { notifyError, notifySuccess } from '@/lib/notify'
import { setLocationPrimaryContact, setDepartmentPrimaryContact } from '../hooks/useCustomerContacts'
import type { ContactScope } from './ContactsPanel'
import type { Contact } from '@/types/customer'
import type { Id } from '@/types/common'

/**
 * Promote this contact to the primary contact OF THIS SITE/DEPARTMENT. It demotes the
 * previous primary of THAT ONE scope only; the customer's own main contact (`isPrimary`)
 * is a different field and is left alone. There is deliberately no "unset" — the backend
 * has no route for it, so the flag moves by promoting someone else instead of by a toggle
 * with nothing behind it. The owning hook refetches via CONTACTS_CHANGED_EVENT.
 */
export function useContactPrimaryPromotion(scope: ContactScope, scopeId: Id | undefined) {
  const { t } = useTranslation('customers')
  const [promoting, setPromoting] = useState<Id | null>(null)
  // The per-site/per-department primary only exists inside those two scopes — a
  // customer-level list has no such coupling to write.
  const applicable = (scope === 'location' || scope === 'department') && scopeId != null

  const promote = async (c: Contact) => {
    if (!applicable || c.id == null || c.customerId == null || promoting != null) return
    setPromoting(c.id)
    // One call per scope, same shape — mirrors setLocationPrimaryContact/
    // setDepartmentPrimaryContact themselves (§11, never a third copy of the PUT).
    const write = scope === 'location' ? setLocationPrimaryContact : setDepartmentPrimaryContact
    const doneKey = scope === 'location' ? 'locations.detail.setPrimaryContactDone' : 'departments.detail.setPrimaryContactDone'
    try {
      const applied = await write(c.customerId, c.id, scopeId as Id)
      // A 200 that did not move the flag is still a failure for the user (the pivot
      // column is not on this tenant database yet) — say so instead of a silent no-op.
      // "Unavailable"/"Failed" copy is scope-neutral (no scope word in either string),
      // so both scopes share the one location.* key rather than a duplicate department.* pair.
      if (applied) notifySuccess(t(doneKey, { name: c.name }))
      else notifyError(t('locations.detail.setPrimaryContactUnavailable'))
    } catch {
      notifyError(t('locations.detail.setPrimaryContactFailed'))
    } finally {
      setPromoting(null)
    }
  }

  return { promoting, promote }
}
