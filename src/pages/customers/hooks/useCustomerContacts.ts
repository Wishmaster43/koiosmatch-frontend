/**
 * useCustomerContacts — a customer's contact persons: GET/POST /customers/{id}/contacts
 * + PATCH/DELETE …/contacts/{contactId}. Fetches the FULL customer-wide list once —
 * shared by the top-level Contactpersonen tab AND the location detail's nested
 * "Contactpersonen op deze locatie" section (filtered client-side by locationId), so
 * both stay one source of truth (couple/uncouple from either place shows up in both).
 *
 * CONTACT-MULTI-1: the backend only supports ONE location + ONE department per
 * contact today (customer_location_id / customer_department_id, single uuid).
 * Danny wants multi eventually — the coupling UI renders as single-value soft chips
 * (see EditableFieldTable's `chip-select` type) so upgrading later is a prop change,
 * not a rebuild. Never silently drop a second value — there is nowhere to put it yet.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { mapContact } from '../data/mapCustomer'
import type { Contact, ApiContact } from '@/types/customer'
import type { Id } from '@/types/common'

// The editable payload — the fields CustomerContactController::validateContact accepts.
export interface ContactPayload {
  firstName: string
  lastName: string
  email: string
  phone: string
  // Split from `phone` (BE 2026-07-20): the separate mobile number (WhatsApp shortcut).
  mobile: string
  role: string
  locationId: Id | null
  departmentId: Id | null
  statusId: Id | null
  isPrimary: boolean
  // Tenant custom-field values (§3B "Eigen velden" — the Extra sub-tab).
  customFields: Record<string, unknown>
}

const isTemp = (id: Id | undefined) => typeof id === 'string' && id.startsWith('tmp-')

// Defensive id-dedupe (Danny 2026-07-14): two seeded contacts (same name+email)
// were observed rendering TWICE — GET /customers/{id}/contacts returned the same
// row id twice for at least one customer. The backend index() query itself has no
// join-fanout (Eloquent `with()` eager-loads via separate queries, one row per
// contact), so a duplicate id in the response is a data/seeder issue, not a query
// bug — reported separately. Regardless of root cause, a duplicate id must never
// render as two rows: dedupe here once, at the single shared source (both the
// Contactpersonen tab AND the location detail's nested list read this one list).
const dedupeById = (rows: Contact[]): Contact[] => {
  const seen = new Set<string>()
  return rows.filter(c => { const k = String(c.id); return seen.has(k) ? false : (seen.add(k), true) })
}

const toApi = (p: Partial<ContactPayload>) => ({
  ...(p.firstName !== undefined ? { first_name: p.firstName } : {}),
  ...(p.lastName !== undefined ? { last_name: p.lastName } : {}),
  ...(p.email !== undefined ? { email: p.email } : {}),
  ...(p.phone !== undefined ? { phone: p.phone } : {}),
  ...(p.mobile !== undefined ? { mobile: p.mobile } : {}),
  ...(p.role !== undefined ? { function: p.role } : {}),
  ...(p.locationId !== undefined ? { customer_location_id: p.locationId || null } : {}),
  ...(p.departmentId !== undefined ? { customer_department_id: p.departmentId || null } : {}),
  ...(p.statusId !== undefined ? { status_id: p.statusId || null } : {}),
  ...(p.isPrimary !== undefined ? { is_primary: p.isPrimary } : {}),
  ...(p.customFields !== undefined ? { custom_fields: p.customFields } : {}),
})

export function useCustomerContacts(customerId: Id | undefined) {
  const { t } = useTranslation('customers')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    if (!customerId) { setContacts([]); setLoading(false); return }
    setLoading(true); setError(false)
    api.get(`/customers/${customerId}/contacts`)
      .then(res => setContacts(dedupeById(unwrapList<ApiContact>(res).rows.map(mapContact))))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [customerId])
  useEffect(() => { load() }, [load])

  // Create — optimistic row with a temp id, swapped for the server row on success.
  // Only the Add-modal's create path calls this (couple/uncouple + inline edits go
  // through `update` below), so it rethrows on failure instead of swallowing to
  // null — the modal awaits it and maps 422 field errors (C-18), rather than the
  // generic toast this used to fire while also closing the modal regardless.
  const add = useCallback((payload: ContactPayload) => {
    if (!customerId) return
    const tmpId = `tmp-${Date.now()}`
    setContacts(cs => [{ ...mapContact({ id: tmpId } as ApiContact), name: `${payload.firstName} ${payload.lastName}`.trim() }, ...cs])
    return api.post(`/customers/${customerId}/contacts`, toApi(payload))
      .then(res => { const saved = mapContact(unwrap<ApiContact>(res)); setContacts(cs => cs.map(x => x.id === tmpId ? saved : x)); return saved })
      .catch(err => { setContacts(cs => cs.filter(x => x.id !== tmpId)); throw err })
  }, [customerId])

  // Update — optimistic patch (partial; used for field edits AND couple/uncouple), reverts on failure.
  const update = useCallback((id: Id, payload: Partial<ContactPayload>) => {
    if (!customerId) return
    const snapshot = contacts
    setContacts(cs => cs.map(x => x.id === id ? { ...x, ...(payload as Partial<Contact>) } : x))
    return api.patch(`/customers/${customerId}/contacts/${id}`, toApi(payload))
      .then(res => { const saved = mapContact(unwrap<ApiContact>(res)); setContacts(cs => cs.map(x => x.id === id ? saved : x)); return saved })
      .catch(() => { setContacts(snapshot); notifyError(t('contacts.saveFailed')); return null })
  }, [customerId, contacts, t])

  // Delete — optimistic remove; a 409 gets its own message.
  const remove = useCallback((id: Id) => {
    if (!customerId) return
    const snapshot = contacts
    setContacts(cs => cs.filter(x => x.id !== id))
    if (isTemp(id)) return
    return api.delete(`/customers/${customerId}/contacts/${id}`)
      .then(() => true)
      .catch(e => {
        setContacts(snapshot)
        notifyError(e?.response?.status === 409 ? t('contacts.deleteInUse') : t('contacts.deleteFailed'))
        return false
      })
  }, [customerId, contacts, t])

  return { contacts, loading, error, reload: load, add, update, remove }
}
