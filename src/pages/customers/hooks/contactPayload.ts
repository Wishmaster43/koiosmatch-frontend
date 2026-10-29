import type { ContactPayload } from './useCustomerContacts'

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
 * ONE-CLICK-COUPLE-2: the full ContactPayload for the "type a brand-new name"
 * quick-create path — shared by AddLocationModal's own-card create and
 * LocationContactSection's "create contact and link" fallback (same fields,
 * same defaults, never a second drifting copy). No LinkedIn field on this
 * quick path (CONTACT-LINKEDIN-1), no location/department yet (the caller
 * links those right after via setLocationPrimaryContact/the coupling call).
 */
export const quickContactPayload = (name: string, email: string, phone: string): ContactPayload => ({
  ...splitContactName(name), middleName: '', email, phone, mobile: '',
  linkedin: '',
  gender: '', role: '', locationId: null, departmentId: null, locationIds: [], departmentIds: [],
  statusId: null, isPrimary: false, customFields: {},
})
