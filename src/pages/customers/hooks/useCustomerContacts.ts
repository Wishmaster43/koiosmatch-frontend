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
 *
 * TWO PRIMARY AXES LIVE HERE, AND THEY ARE NOT THE SAME THING:
 *   · `isPrimary` (customer_contacts.is_primary) — the customer's ONE main contact.
 *     Set through update(); the backend demotes the previous one customer-wide.
 *   · `primaryLocationIds` (customer_contact_customer_location.is_primary) — the primary
 *     contact PER SITE. Set through setLocationPrimaryContact(); the backend demotes the
 *     previous primary of that ONE location and leaves the customer axis untouched.
 * Anything that shows both on one screen must say which is which (ContactsPanel does).
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
  // CONTACT-TUSSENVOEGSEL-1 — validated by CustomerContactController (nullable string).
  middleName: string
  lastName: string
  email: string
  phone: string
  // Split from `phone` (BE 2026-07-20): the separate mobile number (WhatsApp shortcut).
  mobile: string
  // CONTACT-GESLACHT-1: the candidate_genders VALUE SLUG (male|female|other). The
  // backend validates it with `exists:candidate_genders,value` — sending an id 422s.
  gender: string
  role: string
  locationId: Id | null
  departmentId: Id | null
  // CONTACT-MULTI-1: the FULL sets. The backend syncs the pivots from these and derives
  // customer_location_id from the first one; see toApi for why the department's singular
  // id has to be sent alongside.
  locationIds: Id[]
  departmentIds: Id[]
  statusId: Id | null
  isPrimary: boolean
  // Tenant custom-field values (§3B "Eigen velden" — the Extra sub-tab).
  customFields: Record<string, unknown>
}

/**
 * ONE-CLICK-COUPLE-2 (moved from AddLocationModal, 2026-08-03, §11 — one helper, not a
 * second copy): splits a single typed legacy name into the ContactPayload's separate
 * first/last fields — first word -> firstName, the rest -> lastName. A lone word
 * carries no signal for which part it is, so it goes wholly into lastName rather than
 * fabricating a firstName nobody typed (§0.2 "honestly"). The backend requires BOTH
 * fields non-empty on create (CustomerContactController::validateContact), so a
 * genuinely one-word name still 422s on the contact-create call — that failure
 * surfaces through the same honest toast as any other contact-create failure, never
 * silently swallowed. Shared by AddLocationModal's "type a brand-new name" path and
 * LocationContactSection's "create contact and link" dead-end fix — the same split,
 * never a second, drifting copy.
 */
export const splitContactName = (raw: string): Pick<ContactPayload, 'firstName' | 'lastName'> => {
  const words = raw.trim().split(/\s+/).filter(Boolean)
  return words.length > 1
    ? { firstName: words[0], lastName: words.slice(1).join(' ') }
    : { firstName: '', lastName: words[0] ?? '' }
}

/**
 * Broadcast name for "this customer's contact list changed underneath you".
 * A MERGE rewrites two rows at once (the survivor absorbs the duplicate, which then
 * disappears) and is fired from the drill-down, five ContactsPanel call sites away from
 * this hook. Rather than prop-drill a writer through all five, the merge dispatches this
 * and the one hook that OWNS the list refetches — the same `km:` CustomEvent convention
 * the app already uses for km:toast / km:auth-expired / km:open-changelog.
 */
export const CONTACTS_CHANGED_EVENT = 'km:contacts-changed'

/**
 * CONTACT-LOCATION-PRIMARY-1 — a contact row that also carries WHICH of its locations it
 * is the primary contact OF. This is a property of the COUPLING
 * (customer_contact_customer_location.is_primary), a different axis from
 * `customer_contacts.is_primary` above: that one is the customer's ONE main contact,
 * this one is the person you call at ONE site. Both exist side by side and never merge.
 */
export interface ContactWithPrimaryLocations extends Contact {
  /** Ids of the locations where THIS contact is that location's primary contact. */
  primaryLocationIds: Id[]
}

// The pivot flag as CustomerContactResource sends it — inside each `locations[]` entry as
// `is_primary`. The shared ApiContact types that array as {id,name} only, so the extra
// key is read through this one narrowing reader instead of casting at four call sites.
const pivotIsPrimary = (entry: { id?: Id; name?: string }): boolean =>
  (entry as { is_primary?: unknown }).is_primary === true

/**
 * Map a raw contact AND keep the per-location primary flags. The shared `mapContact`
 * narrows every `locations[]` entry to {id,name}, which drops the pivot flag before any
 * screen can see it; widening that shared mapper/type is a change to files this lane does
 * not own, so the ids ride along on the row instead (read back via primaryLocationIdsOf).
 */
const mapContactRow = (raw: ApiContact = {}): ContactWithPrimaryLocations => ({
  ...mapContact(raw),
  primaryLocationIds: (raw.locations ?? [])
    .filter(l => l?.id != null && pivotIsPrimary(l))
    .map(l => l.id as Id),
})

/**
 * Read the per-location primary ids off a contact row.
 *
 * Why a reader and not a typed prop: the rows reach a location's contact list through
 * hops that type their `contacts` prop as the shared `Contact[]` (CustomerDrawer →
 * LocationsTab → LocationDetail), which erases the extra field at the TYPE level even
 * though it is present at runtime. This keeps the fact in one place and degrades to []
 * for any row that did not come from this hook — never a crash, never a wrong star.
 */
export const primaryLocationIdsOf = (c: Contact): Id[] => {
  const ids = (c as Partial<ContactWithPrimaryLocations>).primaryLocationIds
  return Array.isArray(ids) ? ids : []
}

/** True when this contact is the primary contact OF THAT ONE location. */
export const isPrimaryForLocation = (c: Contact, locationId: Id): boolean =>
  primaryLocationIdsOf(c).some(id => String(id) === String(locationId))

/**
 * PUT /customers/{customerId}/contacts/{contactId}/locations/{locationId}/primary —
 * make this contact the primary contact OF THAT LOCATION
 * (CustomerContactController::primaryLocation). The backend demotes the previous primary
 * of that SAME location only, and couples the contact to the site first when it is not
 * linked yet; `customer_contacts.is_primary` (the customer's main contact) is a different
 * column and is never touched by this route.
 *
 * Fired straight from the list rather than prop-drilled — the same convention
 * MergeContactModal already uses for the same reason: the writer sits several hops away
 * from the hook that owns the list, so the hook is told to refetch via
 * CONTACTS_CHANGED_EVENT instead of threading a callback through components this lane
 * does not own.
 *
 * Returns whether the flag ACTUALLY landed. The endpoint is a documented no-op while
 * `customer_contact_customer_location.is_primary` is still missing on a tenant database
 * (CustomerContactLocation::supportsPrimary) — it answers 200 with the flag unchanged.
 * Reconciling on the response instead of assuming success is what stops the button
 * reporting a write that never happened (§3, no fake affordances).
 */
export async function setLocationPrimaryContact(customerId: Id, contactId: Id, locationId: Id): Promise<boolean> {
  const res = await api.put(`/customers/${customerId}/contacts/${contactId}/locations/${locationId}/primary`)
  const applied = isPrimaryForLocation(mapContactRow(unwrap<ApiContact>(res)), locationId)
  // Only a write that actually landed changed anything worth refetching.
  if (applied) window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED_EVENT))
  return applied
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
const dedupeById = <T extends Contact>(rows: T[]): T[] => {
  const seen = new Set<string>()
  return rows.filter(c => { const k = String(c.id); return seen.has(k) ? false : (seen.add(k), true) })
}

const toApi = (p: Partial<ContactPayload>) => ({
  ...(p.firstName !== undefined ? { first_name: p.firstName } : {}),
  ...(p.middleName !== undefined ? { middle_name: p.middleName } : {}),
  ...(p.lastName !== undefined ? { last_name: p.lastName } : {}),
  ...(p.email !== undefined ? { email: p.email } : {}),
  ...(p.phone !== undefined ? { phone: p.phone } : {}),
  ...(p.mobile !== undefined ? { mobile: p.mobile } : {}),
  // Empty string → null: the column is nullable, but '' fails the exists: rule.
  ...(p.gender !== undefined ? { gender: p.gender || null } : {}),
  ...(p.role !== undefined ? { function: p.role } : {}),
  ...(p.locationId !== undefined ? { customer_location_id: p.locationId || null } : {}),
  ...(p.departmentId !== undefined ? { customer_department_id: p.departmentId || null } : {}),
  // Sending the ARRAY wins over the singular field (ContactLocationSync). For locations
  // that is complete — the service derives customer_location_id from the first id. For
  // DEPARTMENTS it does not, so the singular id is sent explicitly: every existing row and
  // every list filter still reads it, and leaving it stale would drop the contact out of
  // its department's list. Reported to the backend as an asymmetry to fix at the source.
  ...(p.locationIds !== undefined ? { location_ids: p.locationIds } : {}),
  ...(p.departmentIds !== undefined ? {
    department_ids: p.departmentIds,
    customer_department_id: p.departmentIds[0] ?? null,
  } : {}),
  ...(p.statusId !== undefined ? { status_id: p.statusId || null } : {}),
  ...(p.isPrimary !== undefined ? { is_primary: p.isPrimary } : {}),
  ...(p.customFields !== undefined ? { custom_fields: p.customFields } : {}),
})

export function useCustomerContacts(customerId: Id | undefined) {
  const { t } = useTranslation('customers')
  // Rows carry the per-location primary flags (CONTACT-LOCATION-PRIMARY-1) alongside the
  // shared Contact shape — see mapContactRow / primaryLocationIdsOf.
  const [contacts, setContacts] = useState<ContactWithPrimaryLocations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Audit r4 (§9): abortable load — a fast customerId switch must never let the
  // previous customer's stale response win, nor setState after unmount.
  const load = useCallback((signal?: AbortSignal) => {
    if (!customerId) { setContacts([]); setLoading(false); return }
    setLoading(true); setError(false)
    api.get(`/customers/${customerId}/contacts`, { signal })
      .then(res => { if (!signal?.aborted) setContacts(dedupeById(unwrapList<ApiContact>(res).rows.map(mapContactRow))) })
      .catch(err => { if (err?.code !== 'ERR_CANCELED' && !signal?.aborted) setError(true) })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }, [customerId])
  useEffect(() => { const ctrl = new AbortController(); load(ctrl.signal); return () => ctrl.abort() }, [load])

  // Refetch when an out-of-tree writer (the merge modal) changed this list. The listener
  // is registered in the effect SETUP and torn down in its cleanup, so StrictMode's
  // setup→cleanup→setup in dev re-arms it instead of leaving it permanently dead (§9).
  useEffect(() => {
    const ctrl = new AbortController()
    const onChanged = () => load(ctrl.signal)
    window.addEventListener(CONTACTS_CHANGED_EVENT, onChanged)
    return () => { window.removeEventListener(CONTACTS_CHANGED_EVENT, onChanged); ctrl.abort() }
  }, [load])

  // Create — optimistic row with a temp id, swapped for the server row on success.
  // Only the Add-modal's create path calls this (couple/uncouple + inline edits go
  // through `update` below), so it rethrows on failure instead of swallowing to
  // null — the modal awaits it and maps 422 field errors (C-18), rather than the
  // generic toast this used to fire while also closing the modal regardless.
  const add = useCallback((payload: ContactPayload) => {
    if (!customerId) return
    const tmpId = `tmp-${Date.now()}`
    // The optimistic row composes the name the SAME way the backend does (full_name):
    // first + tussenvoegsel + last, so it does not flicker into a different name.
    const optimisticName = [payload.firstName, payload.middleName, payload.lastName].filter(Boolean).join(' ').trim()
    setContacts(cs => [{ ...mapContactRow({ id: tmpId } as ApiContact), name: optimisticName }, ...cs])
    return api.post(`/customers/${customerId}/contacts`, toApi(payload))
      .then(res => {
        const saved = mapContactRow(unwrap<ApiContact>(res))
        // Same invariant as update(): a contact created AS primary demotes the previous
        // one server-side, so the local list must not keep showing two.
        setContacts(cs => cs.map(x => x.id === tmpId ? saved
          : (saved.isPrimary && x.isPrimary ? { ...x, isPrimary: false } : x)))
        return saved
      })
      .catch(err => { setContacts(cs => cs.filter(x => x.id !== tmpId)); throw err })
  }, [customerId])

  // Update — optimistic patch (partial; used for field edits AND couple/uncouple), reverts on failure.
  const update = useCallback((id: Id, payload: Partial<ContactPayload>) => {
    if (!customerId) return
    const snapshot = contacts
    // Promoting one contact to primary DEMOTES every other one — the backend does that
    // silently in a saved-event, and it only ever returns the row you patched. Mirroring
    // the invariant here is what stops two rows both showing "Primair" until the drawer
    // is reopened (measured 28-07). One primary per customer, on screen too.
    const demoteOthers = payload.isPrimary === true
    setContacts(cs => cs.map(x => x.id === id
      ? { ...x, ...(payload as Partial<Contact>) }
      : (demoteOthers && x.isPrimary ? { ...x, isPrimary: false } : x)))
    return api.patch(`/customers/${customerId}/contacts/${id}`, toApi(payload))
      .then(res => { const saved = mapContactRow(unwrap<ApiContact>(res)); setContacts(cs => cs.map(x => x.id === id ? saved : x)); return saved })
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

/**
 * archiveContact / restoreContact — ARCHIVE-SUBENTITY-1's reversible soft-delete
 * pair. Standalone functions (not hook-returned callbacks) so they can fire from
 * deep inside ContactDetail without prop-drilling a reload callback through every
 * intermediate component — mirrors setLocationPrimaryContact above, reusing the
 * SAME CONTACTS_CHANGED_EVENT the merge path already dispatches.
 */
export async function archiveContact(customerId: Id, id: Id): Promise<void> {
  await api.post(`/customers/${customerId}/contacts/${id}/archive`)
  window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED_EVENT))
}
export async function restoreContact(customerId: Id, id: Id): Promise<Contact> {
  const res = await api.post(`/customers/${customerId}/contacts/${id}/restore`)
  window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED_EVENT))
  return mapContactRow(unwrap<ApiContact>(res))
}

/**
 * useArchivedCustomerContacts — the ARCHIVED-ONLY sub-list behind the panel's
 * "Gearchiveerd" quick-view (mirrors useArchivedCustomerLocations — see its own
 * doc for why this is a SEPARATE fetch rather than merged into the live list).
 * `active` gates the fetch entirely; refetches on CONTACTS_CHANGED_EVENT.
 */
export function useArchivedCustomerContacts(customerId: Id | undefined, active: boolean) {
  const [contacts, setContacts] = useState<ContactWithPrimaryLocations[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback((signal?: AbortSignal) => {
    if (!active || !customerId) { setContacts([]); return }
    setLoading(true)
    api.get(`/customers/${customerId}/contacts`, { params: { include_archived: 1 }, signal })
      .then(res => { if (!signal?.aborted) setContacts(dedupeById(unwrapList<ApiContact>(res).rows.map(mapContactRow)).filter(c => c.archived)) })
      .catch(() => { /* the toggle simply shows nothing rather than crashing (§3) */ })
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }, [customerId, active])
  useEffect(() => { const ctrl = new AbortController(); load(ctrl.signal); return () => ctrl.abort() }, [load])

  useEffect(() => {
    const ctrl = new AbortController()
    const onChanged = () => load(ctrl.signal)
    window.addEventListener(CONTACTS_CHANGED_EVENT, onChanged)
    return () => { window.removeEventListener(CONTACTS_CHANGED_EVENT, onChanged); ctrl.abort() }
  }, [load])

  return { contacts, loading }
}
