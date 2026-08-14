import { initialsOf } from '@/lib/initials'
import { toCoord } from '@/lib/coords'
import { backofficeLinkOf } from '@/lib/backofficeLink'
import type { Id } from '@/types/common'
import type {
  ApiContact, ApiDepartment, ApiLocation, ApiCustomer,
  Contact, Department, Location, Customer, CustomerNote,
} from '@/types/customer'

// NOTES-LOC-DEPT-1: the raw note-row shape shared by BOTH the embedded
// `customer.notes[]` (CustomerDetailResource) and the standalone scoped-notes
// endpoints (CustomerNoteResource, GET .../notes) — same fields, so ONE mapper
// (below) serves both call sites instead of a forked copy (§11).
export interface ApiCustomerNoteRow {
  id?: Id; type?: string; title?: string; text?: string; body?: string
  created_at?: string; ago?: string
  customer_contact_id?: Id | null; contact_name?: string | null
  customer_location_id?: Id | null; location_name?: string | null
  customer_department_id?: Id | null; department_name?: string | null
  level?: string
  // K15NOTES: sent by BOTH CustomerNoteResource and the embedded
  // CustomerDetailResource list (parity regression-locked server-side, 13-08).
  author_id?: Id | null; updated_by?: string | null
}

/** mapCustomerNoteRow — raw API note row → flat UI shape (CONTACT-NOTITIES-1 + NOTES-LOC-DEPT-1). */
export function mapCustomerNoteRow(n: ApiCustomerNoteRow = {}): CustomerNote {
  return {
    id: n.id, type: n.type ?? '', title: n.title ?? '', text: n.text ?? n.body ?? '', ago: n.created_at ?? n.ago ?? '',
    contactId: n.customer_contact_id ?? null, contactName: n.contact_name ?? '',
    locationId: n.customer_location_id ?? null, locationName: n.location_name ?? '',
    departmentId: n.customer_department_id ?? null, departmentName: n.department_name ?? '',
    level: n.level ?? '',
    // K15NOTES: pass through the ownership/provenance fields (CustomerNoteResource /
    // CustomerDetailResource) so the shared NotesTab can gate edit/delete per note.
    author_id: n.author_id ?? null, updated_by: n.updated_by ?? null,
  }
}

// Compact one-line address: "Straat 12a, 1234 AB Plaats".
// BUG FIX (Danny 13/7): the API field is `postcode`, not `postal_code` — the old
// fallback-only read left postalCode always empty, so the detail row silently
// showed just the city. `postcode` now reads first; `postal_code` stays as a
// defensive fallback for any older payload shape.
const addressLine = (l: ApiLocation = {}): string => {
  const street = [l.street, l.house_number].filter(Boolean).join(' ') + (l.house_number_suffix ? l.house_number_suffix : '')
  const city = [l.postcode ?? l.postal_code, l.city].filter(Boolean).join(' ')
  return [street.trim(), city.trim()].filter(Boolean).join(', ')
}

// A tenant lookup status embedded on a sub-entity (SUB-STATUS-1) → the flat value/label/color triad.
const mapStatusRef = (s?: { value?: string; label?: string; color?: string } | null) => ({
  status: s?.value ?? '',
  statusLabel: s?.label ?? '',
  statusColor: s?.color ?? '',
})

/** mapDepartment — raw API department → flat UI shape (nested under a location). */
export function mapDepartment(d: ApiDepartment = {}): Department {
  return {
    id: d.id,
    // NUMMER-1: human-readable reference number (A-001).
    referenceNumber: d.reference_number ?? '',
    // EXTRACT-1: the backoffice links (Koppelingen sub-tab).
    helloflexLink: backofficeLinkOf(d.backoffice_links, 'helloflex'),
    shiftmanagerLink: backofficeLinkOf(d.backoffice_links, 'shiftmanager'),
    name: d.name ?? '—',
    description: d.description ?? '',
    locationId: d.location_id ?? d.locationId ?? null,
    locationName: d.location_name ?? d.location?.name ?? d.locationName ?? '',
    contacts: (d.contacts ?? []).map(mapContact),
    // Kostenplaats (Danny 2026-07-22) — the middle cascade level.
    costCenter: d.cost_center ?? '',
    statusId: d.status_id ?? null,
    ...mapStatusRef(d.status),
    customFields: d.custom_fields ?? {},
    // SUBENTITEIT-DELETE-1: false when absent (a write response never sets it).
    inUse: Boolean(d.in_use),
    // ARCHIVE-SUBENTITY-1: same convention as mapVacancy.ts — derived from the
    // explicit flag, falling back to the raw timestamp for an older payload shape.
    archived: Boolean(d.archived ?? (d.deleted_at != null)),
    archivedAt: d.deleted_at ?? null,
  }
}

/** mapContact — raw API contact person → flat UI shape. */
export function mapContact(p: ApiContact = {}): Contact {
  // CONTACT-MULTI-1: the full multi-location/department set (BUG FIX Danny 2026-07-14 —
  // the Contactpersonen table's Locatie/Afdeling columns read the OLD singular
  // location_name/department_name, which the list endpoint never populates; only the
  // arrays below are eager-loaded there). Filter out any row missing an id defensively.
  const locations = (p.locations ?? []).filter((l): l is { id: Id; name?: string } => l?.id != null)
    .map(l => ({ id: l.id, name: l.name ?? '—' }))
  const departments = (p.departments ?? []).filter((d): d is { id: Id; name?: string } => d?.id != null)
    .map(d => ({ id: d.id, name: d.name ?? '—' }))
  return {
    id: p.id,
    // NUMMER-2: the human-readable number, shown as a copy chip next to the name.
    referenceNumber: p.reference_number ?? '',
    // The owning customer — the merge route is scoped to it, so the drill-down needs it.
    customerId: p.customer_id ?? null,
    firstName: p.first_name ?? '',
    middleName: p.middle_name ?? '',
    lastName: p.last_name ?? '',
    name: p.name ?? [p.first_name, p.last_name].filter(Boolean).join(' ') ?? '—',
    role: p.function ?? p.role ?? '',
    email: p.email ?? '',
    // EXTRACT-1: the backoffice links (Koppelingen sub-tab).
    helloflexLink: backofficeLinkOf(p.backoffice_links, 'helloflex'),
    shiftmanagerLink: backofficeLinkOf(p.backoffice_links, 'shiftmanager'),
    // Split fields (BE 2026-07-20): phone stays the landline/"vast" number; mobile
    // is the new separate mobile number the WhatsApp shortcut uses.
    phone: p.phone ?? '',
    mobile: p.mobile ?? '',
    // CONTACT-LINKEDIN-1 (Danny 05-08): the profile slug, read straight off the
    // resource — the FE builds https://www.linkedin.com/in/{slug} from it.
    linkedin: p.linkedin_slug ?? '',
    // CONTACT-GESLACHT-1: the gender VALUE SLUG (male|female|other) straight off the
    // resource — never an id, so the /genders lookup resolves label+colour from it.
    gender: p.gender ?? '',
    isPrimary: Boolean(p.is_primary ?? p.isPrimary),
    locationId: p.customer_location_id ?? p.location_id ?? p.locationId ?? null,
    locationName: p.location_name ?? p.location?.name ?? locations[0]?.name ?? '',
    departmentId: p.customer_department_id ?? p.department_id ?? p.departmentId ?? null,
    departmentName: p.department_name ?? p.department?.name ?? departments[0]?.name ?? '',
    locations,
    departments,
    statusId: p.status_id ?? null,
    ...mapStatusRef(p.status),
    // CONTACT-LAATSTE-CONTACT-1: mirrors mapCandidate's identical pair. LIVE — the
    // resource now sends both, so the table's "Laatste contact" column shows real data
    // (it rendered a blanket dash for as long as the resource omitted the columns).
    lastContactAt: p.last_contact_at ?? null,
    lastContactType: p.last_contact_type ?? null,
    customFields: p.custom_fields ?? {},
    // ARCHIVE-SUBENTITY-1: same convention as mapVacancy.ts.
    archived: Boolean(p.archived ?? (p.deleted_at != null)),
    archivedAt: p.deleted_at ?? null,
  }
}

/** mapLocation — raw API location → flat UI shape with C-6 address fields. */
export function mapLocation(l: ApiLocation = {}): Location {
  const departments = (l.departments ?? []).map(mapDepartment)
  const contacts = (l.contacts ?? []).map(mapContact)
  return {
    id: l.id,
    // NUMMER-1: human-readable reference number (L-001).
    referenceNumber: l.reference_number ?? '',
    // EXTRACT-1: the backoffice links (Koppelingen sub-tab).
    helloflexLink: backofficeLinkOf(l.backoffice_links, 'helloflex'),
    shiftmanagerLink: backofficeLinkOf(l.backoffice_links, 'shiftmanager'),
    // K4BLOGO: the signed logo URL, straight through — a fresh one on every read.
    logoUrl: l.logo_url ?? null,
    name: l.name ?? '—',
    street: l.street ?? '',
    houseNumber: l.house_number ?? '',
    houseNumberSuffix: l.house_number_suffix ?? '',
    // BUG FIX (Danny 13/7): read the real `postcode` field, not `postal_code`.
    postalCode: l.postcode ?? l.postal_code ?? '',
    city: l.city ?? '',
    state: l.state ?? '',
    country: l.country ?? '',
    cocNumber: l.coc_number ?? '',
    vatNumber: l.vat_number ?? '',
    contactName: l.contact_name ?? '',
    // LOCATIE-VESTIGING-1: only sent when the caller eager-loaded branchLinks, so every
    // field defaults defensively. `branchInherited` defaults TRUE — no data means "no
    // deviation recorded", which is exactly what inheriting means.
    branchIds: (l.branch_ids ?? []).filter((x): x is Id => x != null),
    branches: (l.branches ?? []).filter((b): b is { id: Id; name?: string } => b?.id != null).map(b => ({ id: b.id, name: b.name ?? '—' })),
    branchInherited: l.branch_inherited ?? true,
    effectiveBranches: (l.effective_branches ?? []).filter((b): b is { id: Id; name?: string } => b?.id != null).map(b => ({ id: b.id, name: b.name ?? '—' })),
    // PDOK coordinates — tolerant coercion (Laravel decimals arrive as strings, §10).
    lat: toCoord(l.lat),
    lng: toCoord(l.lng),
    phone: l.phone ?? '',
    email: l.email ?? '',
    costCenter: l.cost_center ?? '',
    billingEmail: l.billing_email ?? '',
    // LOCATIE-OMSCHRIJVING-1 (Danny 02-08): this was never mapped at all — the
    // column round-trips fine (mirrors mapDepartment's identical read below), the
    // read side simply had no field to land in.
    description: l.description ?? '',
    address: addressLine(l),
    departments,
    contacts,
    statusId: l.status_id ?? null,
    ...mapStatusRef(l.status),
    customFields: l.custom_fields ?? {},
    // SUBENTITEIT-DELETE-1: false when absent (a write response never sets it).
    inUse: Boolean(l.in_use),
    // ARCHIVE-SUBENTITY-1: same convention as mapVacancy.ts.
    archived: Boolean(l.archived ?? (l.deleted_at != null)),
    archivedAt: l.deleted_at ?? null,
  }
}

/**
 * mapCustomer — raw API customer → the flat shape the table/insights/drawer
 * render. Snake_case-tolerant and defensive about field names so a missing
 * field never throws. Status arrives either as a string (value) or an object
 * { value, label, color }; both are normalised, with the lookup as fallback.
 */
export function mapCustomer(c: ApiCustomer = {}): Customer {
  const owner: { id?: Id; name?: string; avatar_color?: string | null } = c.owner ?? {}
  const status = c.status
  const statusValue = (status && typeof status === 'object') ? (status.value ?? '') : (status ?? c.status_id ?? '')
  const locations = (c.locations ?? []).map(mapLocation)
  // Departments live under locations; if the API also sends a flat raw list, map
  // that — otherwise reuse the already-mapped ones (no redundant double-mapping).
  const departments: Department[] = c.departments
    ? c.departments.map(mapDepartment)
    : locations.flatMap(l => l.departments)
  const contacts = (c.contacts ?? c.contact_persons ?? []).map(mapContact)

  return {
    id: c.id,
    // NUMMER-1: human-readable reference number (D-4).
    referenceNumber: c.reference_number ?? '',
    name: c.name ?? '—',
    initials: initialsOf(c.name),
    debtorNumber: c.debtor_number ?? c.debtorNumber ?? '',
    // BRANCH-1 (Danny 27-07: "een klant moet gekoppeld worden aan een vestiging, maar
    // ik mis vestiging in de drilldown"). The backend already delivers it — branch
    // {id,name} plus the flat branch_id/location_id — it was simply never mapped, so
    // the drawer could not show or edit it.
    branchId: (c.branch?.id ?? c.branch_id ?? (c.location_id as Id | undefined) ?? null) as Id | null,
    branchName: c.branch?.name ?? c.branch_name ?? '',
    // EXTRACT-1: the backoffice links (Koppelingen tab).
    helloflexLink: backofficeLinkOf(c.backoffice_links, 'helloflex'),
    shiftmanagerLink: backofficeLinkOf(c.backoffice_links, 'shiftmanager'),
    status: statusValue,
    statusLabel: (status && typeof status === 'object') ? status.label : c.status_label,
    statusColor: (status && typeof status === 'object') ? status.color : c.status_color,
    // KLANT-FASE-1: the lifecycle phase slug. Both resources send a bare string, but
    // the column is null-safe backend-side, so an older payload may omit it entirely —
    // '' then means "no phase yet" and the chip falls back to a dash.
    phase: typeof c.phase === 'string' ? c.phase : '',
    owner: owner.name ?? c.account_manager ?? c.owner_name ?? '',
    ownerId: owner.id ?? c.owner_id ?? null,
    ownerInitials: initialsOf(owner.name ?? c.account_manager ?? c.owner_name ?? ''),
    ownerColor: owner.avatar_color ?? c.owner_color ?? null,
    // KLANT-ADRES-1 (backend 28-07): the customer's own address block. Same defensive
    // read as the location mapper — the BE field is `postcode`, `postal_code` is only
    // tolerated for older payloads.
    street: c.street ?? '',
    houseNumber: c.house_number ?? '',
    houseNumberSuffix: c.house_number_suffix ?? '',
    postalCode: c.postcode ?? c.postal_code ?? '',
    city: c.city ?? '',
    state: c.state ?? '',
    country: c.country ?? '',
    // KLANT-KVK-1: the customer's head KvK/VAT (a location holds the sub-number).
    cocNumber: c.coc_number ?? '',
    vatNumber: c.vat_number ?? '',
    // JOB-CONTACT-1 (Danny 28-07): the customer's own e-mail/phone — the backend
    // already sends both (CustomerDetailResource), the mapper simply never read them.
    email: c.email ?? '',
    phone: c.phone ?? '',
    // STRAAL-1: geocoded coordinates + radius distance from the server.
    // PDOK-LATLNG-1: tolerant coercion — Laravel decimals arrive as strings (see lib/coords).
    lat: toCoord(c.lat),
    lng: toCoord(c.lng),
    distanceKm: toCoord(c.distance_km),
    industry: (c.industry && typeof c.industry === 'object') ? (c.industry.name ?? '') : (c.industry ?? ''),
    website: c.website ?? '',
    employeeCount: c.employee_count ?? c.employeeCount ?? '',
    toneOfVoice: c.tone_of_voice ?? c.toneOfVoice ?? '',
    description: c.description ?? '',
    recruitmentProblems: c.recruitment_problems ?? c.recruitmentProblems ?? '',
    hideCompanyName: Boolean(c.hide_company_name),
    hasCareerPage: Boolean(c.has_career_page),
    showInVacancies: Boolean(c.show_in_my_vacancies),
    excludeFromSourcing: Boolean(c.exclude_from_sourcing),
    // Kostenplaats + facturatie-email (Danny 2026-07-22) — the top of the cost-
    // centre cascade and the ONE source billing email always reads from.
    costCenter: c.cost_center ?? '',
    billingEmail: c.billing_email ?? '',
    tags: c.tags ?? [],
    // Archived = soft-deleted (deleted_at). Off by default in the list; the
    // "Gearchiveerd" view opts in via ?include_archived=1.
    archived: !!(c.deleted_at ?? c.archived),
    archivedAt: c.deleted_at ?? null,
    // TRASH-OVERAL-2 lifecycle (mirrors mapCandidate): server value first, else
    // derived from the stamps — a missing field stays 'active'/null so old
    // fixtures/payloads keep working.
    lifecycle: c.lifecycle ?? (c.pending_erase_at ? 'pending_erase' : (c.deleted_at || c.archived) ? 'archived' : 'active'),
    pendingEraseAt: c.pending_erase_at ?? null,
    locations,
    departments,
    contacts,
    // CONTACT-NOTITIES-1 (Danny quick win): the person a note is filed against —
    // both were returned by CustomerDetailResource all along but dropped here, so
    // the drawer could never show or set the link (contactId null = a company-level note).
    // NOTES-LOC-DEPT-1: shares the ONE row mapper with the scoped notes endpoints
    // (useScopedCustomerNotes) — never a second, drifting copy of this shape (§11).
    notes: (c.notes ?? []).map(mapCustomerNoteRow),
    // K17: mirrors mapCandidate's own timeline mapping 1:1 (text/time fallback
    // chains) — but stays UNDEFINED (never `?? []`) when the backend embed is
    // absent, so the Tijdlijn sub-tab can tell "no events yet" apart from "this
    // tenant's API doesn't send the field yet" and fall back to the /activity GET.
    timeline: c.timeline?.map(ev => ({
      ...ev,
      text: ev.text ?? ev.description,
      time: ev.time ?? ev.created_at,
    })),
    locationsCount: c.locations_count ?? locations.length,
    departmentsCount: c.departments_count ?? departments.length,
    contactsCount: c.contacts_count ?? contacts.length,
    openVacanciesCount: c.open_vacancies_count ?? c.openVacanciesCount ?? 0,
    activeMatchesCount: c.active_matches_count ?? c.activeMatchesCount ?? 0,
    created: c.created_at ?? c.created ?? '',
    logo: c.logo ?? c.logo_url ?? null,
    koiosAdvice: c.koios_advice ?? c.koiosAdvice ?? null,
    // Tenant custom-field values (§3B "Eigen velden").
    customFields: c.custom_fields ?? {},
  }
}
