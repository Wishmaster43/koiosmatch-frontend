import api, { unwrap } from '@/lib/api'
import { mapContact } from '../data/mapCustomer'
import type { Contact, ApiContact } from '@/types/customer'
import type { Id } from '@/types/common'

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
 * CONTACT-LOCATION-PRIMARY-1 — a contact row that also carries WHICH of its locations/
 * departments it is the primary contact OF. This is a property of the COUPLING
 * (customer_contact_customer_location.is_primary / customer_contact_customer_department.
 * is_primary), a different axis from `customer_contacts.is_primary` above: that one is
 * the customer's ONE main contact, these are the person you call at ONE site/department.
 * All three exist side by side and never merge.
 */
export interface ContactWithPrimaryFlags extends Contact {
  /** Ids of the locations where THIS contact is that location's primary contact. */
  primaryLocationIds: Id[]
  /** CONTACT-DEPARTMENT-PRIMARY-1: same idea, one level down — the departments where
   * THIS contact is that department's primary contact. */
  primaryDepartmentIds: Id[]
}

// The pivot flag as CustomerContactResource sends it — inside each `locations[]`/
// `departments[]` entry as `is_primary`. The shared ApiContact types those arrays as
// {id,name} only, so the extra key is read through this one narrowing reader instead of
// casting at every call site.
const pivotIsPrimary = (entry: { id?: Id; name?: string }): boolean =>
  (entry as { is_primary?: unknown }).is_primary === true

/**
 * Map a raw contact AND keep the per-location/per-department primary flags. The shared
 * `mapContact` narrows every `locations[]`/`departments[]` entry to {id,name}, which drops
 * the pivot flag before any screen can see it; widening that shared mapper/type is a
 * change to files this lane does not own, so the ids ride along on the row instead (read
 * back via primaryLocationIdsOf / primaryDepartmentIdsOf).
 */
export const mapContactRow = (raw: ApiContact = {}): ContactWithPrimaryFlags => ({
  ...mapContact(raw),
  primaryLocationIds: (raw.locations ?? [])
    .filter(l => l?.id != null && pivotIsPrimary(l))
    .map(l => l.id as Id),
  // CONTACT-DEPARTMENT-PRIMARY-1: exact department twin of the line above.
  primaryDepartmentIds: (raw.departments ?? [])
    .filter(d => d?.id != null && pivotIsPrimary(d))
    .map(d => d.id as Id),
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
  const ids = (c as Partial<ContactWithPrimaryFlags>).primaryLocationIds
  return Array.isArray(ids) ? ids : []
}

/** True when this contact is the primary contact OF THAT ONE location. */
export const isPrimaryForLocation = (c: Contact, locationId: Id): boolean =>
  primaryLocationIdsOf(c).some(id => String(id) === String(locationId))

/**
 * CONTACT-DEPARTMENT-PRIMARY-1: the exact department twin of primaryLocationIdsOf —
 * same reason for existing (the type erases at the DepartmentDetail/ContactsPanel hops),
 * same degrade-to-[] for a row that never came from this hook.
 */
export const primaryDepartmentIdsOf = (c: Contact): Id[] => {
  const ids = (c as Partial<ContactWithPrimaryFlags>).primaryDepartmentIds
  return Array.isArray(ids) ? ids : []
}

/** True when this contact is the primary contact OF THAT ONE department. */
export const isPrimaryForDepartment = (c: Contact, departmentId: Id): boolean =>
  primaryDepartmentIdsOf(c).some(id => String(id) === String(departmentId))

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

/**
 * PUT /customers/{customerId}/contacts/{contactId}/departments/{departmentId}/primary —
 * the exact department twin of setLocationPrimaryContact above (CONTACT-DEPARTMENT-
 * PRIMARY-1; route verified against routes/api/tenant/customers.php:181,
 * CustomerContactController::primaryDepartment — a mirror of the location route at :178).
 * Same shape, same reconcile-on-response, same refetch-only-on-real-write semantics.
 */
export async function setDepartmentPrimaryContact(customerId: Id, contactId: Id, departmentId: Id): Promise<boolean> {
  const res = await api.put(`/customers/${customerId}/contacts/${contactId}/departments/${departmentId}/primary`)
  const applied = isPrimaryForDepartment(mapContactRow(unwrap<ApiContact>(res)), departmentId)
  // Only a write that actually landed changed anything worth refetching.
  if (applied) window.dispatchEvent(new CustomEvent(CONTACTS_CHANGED_EVENT))
  return applied
}
