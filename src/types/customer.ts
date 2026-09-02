/**
 * Customer shapes — the UI models (Customer + nested Location/Department/Contact)
 * and the raw API records, read defensively by the mappers in mapCustomer.js.
 * Status/industry arrive either as a scalar or a { value/label/color|name } object.
 */
import type { Id } from './common'
import type { ApiBackofficeLink, BackofficeLink } from '@/lib/backofficeLink'

/** A contact person (flat UI shape). SUB-STATUS-1 status + CONTACT-MULTI-1 multi coupling. */
export interface Contact {
  // Dossier free-text (wire `description`, CMBE b87e3240); the note THREAD is separate.
  description?: string
  id: Id | undefined
  // NUMMER-2: immutable human-readable display number (C-00042).
  referenceNumber?: string
  // EXTRACT-1: the backoffice links (Koppelingen sub-tab), mapped from
  // backoffice_links[] — same shape/endpoint every entity shares.
  helloflexLink: BackofficeLink | null
  shiftmanagerLink: BackofficeLink | null
  // The owning customer — the merge route is scoped to it (POST /customers/{customerId}/
  // contacts/{id}/merge), so the drill-down can fire the merge without the parent
  // prop-drilling the id down through five ContactsPanel call sites.
  customerId: Id | null
  firstName: string
  // CONTACT-TUSSENVOEGSEL-1: the Dutch tussenvoegsel, same field the candidate has. The
  // backend composes `name` from first + middle + last; without this the FE PATCHed a
  // name with the tussenvoegsel missing and the stored value was quietly destroyed.
  middleName: string
  lastName: string
  name: string
  role: string
  email: string
  phone: string
  // Split from `phone` (BE 2026-07-20): phone stays the landline/"vast" number,
  // mobile is the separate mobile number the WhatsApp shortcut uses.
  mobile: string
  // CONTACT-LINKEDIN-1 (Danny 05-08): the profile SLUG only (`linkedin_slug` on the
  // backend, mirrors candidates.linkedin_slug) — the FE builds linkedin.com/in/{slug}.
  // Optional so the many existing test fixtures across this entity need no update;
  // mapContact below always sets it to a real string (possibly '') at runtime.
  linkedin?: string
  // CONTACT-GESLACHT-1: the candidate_genders VALUE SLUG (male|female|other) — a plain
  // column, NOT a gender_id. Label/colour resolve through the shared /genders lookup
  // exactly like a candidate, so the option list is never hardcoded here.
  gender: string
  isPrimary: boolean
  // Derived PRIMARY link (first of the full set below) — kept for the single-value
  // pickers/filters (e.g. LocationContacts' "belongs to this location" scoping).
  locationId: Id | null
  locationName: string
  departmentId: Id | null
  departmentName: string
  // CONTACT-MULTI-1: the FULL set — a contact can serve several sites/departments
  // of the same customer. Read by the Contactpersonen table's Locatie/Afdeling
  // columns (multi-ready); the singular fields above stay the primary-link filter.
  locations: { id: Id; name: string }[]
  departments: { id: Id; name: string }[]
  statusId: Id | null
  status: string
  statusLabel: string
  statusColor: string
  // CONTACT-LAATSTE-CONTACT-1: `customer_contacts.last_contact_at`, stamped by the
  // backend's RecordsLastContact trait. LIVE since CustomerContactResource started
  // exposing it — the columns always existed, only the resource was missing them.
  lastContactAt: string | null
  // The channel slug (a last_contact_types lookup value); label/icon resolve via useLastContactTypes.
  lastContactType: string | null
  customFields: Record<string, unknown>
  // CONTACT-TEKST-1: the free-text block (rich-text HTML, sanitised on read via
  // SafeHtml). CustomerContactResource `notes` — cite:
  // app/Http/Resources/Customer/CustomerContactResource.php ("'notes' => $this->notes,").
  // Optional (not every existing test fixture across this entity sets it) — read
  // defensively as `?? ''`, mirroring the other optional flags on this interface.
  notes?: string
  // ARCHIVE-SUBENTITY-1: soft-delete state (derived from deleted_at) — off by
  // default in every list, restorable from the archived quick-view. Optional
  // (not every existing test fixture sets it) — read defensively as `?? false`.
  archived?: boolean
  archivedAt?: string | null
}

/** A department nested under a location (flat UI shape). SUB-STATUS-1: lifecycle status. */
export interface Department {
  id: Id | undefined
  // NUMMER-1: human-readable reference number (A-001).
  referenceNumber?: string
  // EXTRACT-1: the backoffice links (Koppelingen sub-tab).
  helloflexLink: BackofficeLink | null
  shiftmanagerLink: BackofficeLink | null
  name: string
  description: string
  locationId: Id | null
  locationName: string
  contacts: Contact[]
  // Cost centre — the middle cascade level (department > location > customer, Danny
  // 2026-07-22). billingEmail joined it (K-249 C.4, 31-08): the match billing
  // resolver reads a department's own billing_email too — supersedes the
  // earlier "billing is always the customer's own" call.
  costCenter: string
  billingEmail: string
  statusId: Id | null
  status: string
  statusLabel: string
  statusColor: string
  customFields: Record<string, unknown>
  // SUBENTITEIT-DELETE-1: the index-level "still referenced" flag (false on a
  // write response, where the controller never sets it) — drives the honest
  // disabled-trash affordance (§3: no fake delete button).
  inUse: boolean
  // ARCHIVE-SUBENTITY-1: soft-delete state (derived from deleted_at) — off by
  // default in every list, restorable from the archived quick-view. Optional
  // (not every existing test fixture sets it) — read defensively as `?? false`.
  archived?: boolean
  archivedAt?: string | null
}

/** A customer location with C-6 address fields (flat UI shape). SUB-STATUS-1: lifecycle status. */
export interface Location {
  id: Id | undefined
  // NUMMER-1: human-readable reference number (L-001).
  referenceNumber?: string
  // EXTRACT-1: the backoffice links (Koppelingen sub-tab).
  helloflexLink: BackofficeLink | null
  shiftmanagerLink: BackofficeLink | null
  // K4BLOGO: this location's own logo — a fresh short-lived signed URL, never
  // stored client-side beyond the current read (mirrors the tenant logo model).
  logoUrl: string | null
  name: string
  street: string
  houseNumber: string
  houseNumberSuffix: string
  postalCode: string
  city: string
  state: string
  country: string
  cocNumber: string
  vatNumber: string
  contactName: string
  phone: string
  email: string
  // LOCATIE-VESTIGING-1: this site's OWN branch couplings. EMPTY is meaningful — it means
  // "no deviation", so the site inherits the customer's set and the customer stays the one
  // source of truth. `branchInherited` says which of the two you are looking at, and
  // `effectiveBranches` is what the site actually works under (derived, never stored).
  branchIds: Id[]
  branches: { id: Id; name: string }[]
  branchInherited: boolean
  effectiveBranches: { id: Id; name: string }[]
  // PDOK coordinates — customer_locations.lat/lng, float-cast by CustomerLocationResource.
  // There is no per-location re-geocode route yet, so these are read-only in the UI.
  lat: number | null
  lng: number | null
  costCenter: string
  billingEmail: string
  // LOCATIE-OMSCHRIJVING-1 (Danny 02-08): free company text about this site, same
  // shape as the department's own `description`.
  description: string
  address: string
  departments: Department[]
  contacts: Contact[]
  statusId: Id | null
  status: string
  statusLabel: string
  statusColor: string
  customFields: Record<string, unknown>
  // SUBENTITEIT-DELETE-1: same honest-delete flag as Department.
  inUse: boolean
  // ARCHIVE-SUBENTITY-1: soft-delete state (derived from deleted_at) — off by
  // default in every list, restorable from the archived quick-view. Optional
  // (not every existing test fixture sets it) — read defensively as `?? false`.
  archived?: boolean
  archivedAt?: string | null
}

/** A customer note (flat UI shape). */
export interface CustomerNote {
  id: Id | undefined
  type: string
  title: string
  text: string
  ago: string
  // DATUM-1: raw timestamp for the shared NotesTab's house date formatting.
  created_at?: string
  // Author display name (CustomerNoteResource) — the meta line's "by whom".
  author?: string
  // CONTACT-NOTITIES-1: the contactpersoon this note is filed against (null = a
  // company-level note) — both read straight off CustomerDetailResource.
  contactId: Id | null
  contactName: string
  // NOTES-LOC-DEPT-1: the OPTIONAL deeper link — a note may hang off one location
  // or one department of this customer instead of the company as a whole (both
  // null = a company-level note, mirrors contactId/contactName above). `level`
  // ('customer'/'location'/'department') is the backend's own resolved reading,
  // used only for display priority (a note never carries more than one link).
  locationId: Id | null
  locationName: string
  departmentId: Id | null
  departmentName: string
  level?: string
  // K15NOTES: creator's user id (null = system/legacy note, not self-claimable) +
  // last editor's name — mirrors CandidateNote's author_id/updated_by so the shared
  // NotesTab can gate the edit/delete buttons (own note or customers.notes.manage_all).
  author_id?: Id | null
  updated_by?: string | null
  // Loose backend note shape — keeps it compatible with the shared NotesTab item.
  [k: string]: unknown
}

/** The flat customer model rendered by the table/insights/drawer. */
export interface Customer {
  id: Id | undefined
  // NUMMER-1: human-readable reference number (D-4). Tenant-configurable
  // prefix/padding/start (Settings → Nummering); server-assigned, immutable.
  referenceNumber?: string
  // ONTKOPPEL-TELLER-1: how many applications across ALL this customer's vacancies
  // are CURRENTLY detached (soft-deleted, not restored) — the whole-history total,
  // never a filtered-window count. 0/undefined when nothing is detached.
  detachedCount?: number
  name: string
  initials: string
  debtorNumber: string
  // BRANCH-1 (Danny 27-07): the tenant establishment this customer hangs on. The API
  // sends it as branch {id,name} + a flat branch_id/location_id; the picker writes
  // location_id back, which the backend validates against real establishments.
  branchId: Id | null
  branchName: string
  // EXTRACT-1: the backoffice links (Koppelingen tab) — same shape/endpoint every entity shares.
  helloflexLink: BackofficeLink | null
  shiftmanagerLink: BackofficeLink | null
  status: string | number
  statusLabel: string | undefined
  statusColor: string | undefined
  // KLANT-FASE-1: the lifecycle phase SLUG (customer_phases.value) — "prospect or
  // customer", a different axis than `status`. The API sends a bare slug; label and
  // colour are resolved from the /customer-phases lookup (useCustomerPhases).
  phase: string
  owner: string
  ownerId: Id | null
  ownerInitials: string
  ownerColor: string | null
  // KLANT-ADRES-1 (delivered by the backend 28-07): the customer's OWN address, the
  // same column names the candidate and the location already use. Before this the
  // customers table had only `city`, which is why the Bedrijf tab showed a one-row
  // address block — see OverviewTab.
  street: string
  houseNumber: string
  houseNumberSuffix: string
  postalCode: string
  city: string
  state: string
  country: string
  // KLANT-KVK-1: head registration numbers on the customer itself; a location carries
  // the SUB-registration below it (customer_locations.coc_number).
  cocNumber: string
  vatNumber: string
  // JOB-CONTACT-1 (Danny 28-07: "elke hoofdklant moet ... contactgegevens hebben") —
  // the customer's OWN e-mail/phone, distinct from a contact person's. The API
  // already sent these (CustomerDetailResource); only the FE mapper never read them.
  email: string
  phone: string
  // STRAAL-1: geocoded coordinates + radius-query distance (null until geocoded).
  lat: number | null
  lng: number | null
  distanceKm: number | null
  industry: string
  website: string
  employeeCount: string | number
  toneOfVoice: string
  description: string
  recruitmentProblems: string
  hideCompanyName: boolean
  hasCareerPage: boolean
  showInVacancies: boolean
  excludeFromSourcing: boolean
  // Cost centre + billing email at the CUSTOMER level (Danny 2026-07-22):
  // cost-centre is the top of the department>location>customer cascade; billing email
  // is the ONE source of truth for invoicing regardless of the picked level.
  costCenter: string
  billingEmail: string
  tags: unknown[]
  archived: boolean
  archivedAt: string | null
  // TRASH-OVERAL-2 lifecycle: 'active' | 'archived' | 'pending_erase' (trash) —
  // drives the Gearchiveerd/Prullenbak view split, mirrors Candidate.lifecycle.
  lifecycle: string
  pendingEraseAt: string | null
  locations: Location[]
  departments: Department[]
  contacts: Contact[]
  notes: CustomerNote[]
  // K17: event-typed timeline embedded on CustomerDetailResource (mirrors
  // Candidate.timeline) — status changes, appointments, notes, tasks, matches.
  // Undefined (not []) means the backend embed is absent, the SIGNAL the
  // Tijdlijn sub-tab falls back to the standalone /activity GET on (§10,
  // tolerant of a not-yet-shipped backend field).
  timeline?: Array<Record<string, unknown>>
  locationsCount: number
  departmentsCount: number
  contactsCount: number
  openVacanciesCount: number
  activeMatchesCount: number
  created: string
  logo: string | null
  // `source` tags WHO produced this advice (mirrors CandidateAdvice) — the honest
  // gate in useCustomerAdvice only trusts a backend value once it declares one.
  koiosAdvice: { action?: string; label?: string; reason?: string; source?: string } | null
  // Tenant custom-field values (§3B "Eigen velden" — the drawer's gated Extra tab).
  customFields: Record<string, unknown>
}

/** A tenant lookup status as embedded on a location/department/contact (SUB-STATUS-1). */
export interface ApiStatusRef { value?: string; label?: string; color?: string }

/** Raw API contact (read defensively). CustomerContactResource sends first_name/last_name + a composed `name`. */
export interface ApiContact {
  id?: Id; reference_number?: string; first_name?: string; middle_name?: string; last_name?: string; name?: string; function?: string; role?: string; email?: string; phone?: string
  // Split from `phone` (BE 2026-07-20): the mobile number (CustomerContactResource `mobile`).
  mobile?: string
  // CONTACT-LINKEDIN-1: symmetric on both read and write (unlike the candidate's
  // linkedin/linkedin_slug asymmetry) — CustomerContactResource sends this exact key.
  linkedin_slug?: string | null
  // CONTACT-GESLACHT-1: the candidate_genders value slug (male|female|other), NOT an id.
  gender?: string | null
  // The owning customer (CustomerContactResource `customer_id`) — scopes the merge route.
  customer_id?: Id
  is_primary?: unknown; isPrimary?: unknown
  // The BE field is `customer_location_id` / `customer_department_id`; location_id/locationId tolerated for older payloads.
  customer_location_id?: Id; location_id?: Id; locationId?: Id; location_name?: string; location?: { name?: string }
  customer_department_id?: Id; department_id?: Id; departmentId?: Id; department_name?: string; department?: { name?: string }
  // CONTACT-MULTI-1: the full multi-location/department set, sent only when the
  // caller eager-loaded them (whenLoaded on the resource).
  locations?: { id?: Id; name?: string }[]
  departments?: { id?: Id; name?: string }[]
  status?: ApiStatusRef | null; status_id?: Id | null
  // CONTACT-LAATSTE-CONTACT-1: both live on CustomerContactResource (ISO-8601 + slug).
  last_contact_at?: string | null; last_contact_type?: string | null
  custom_fields?: Record<string, unknown>
  // CONTACT-TEKST-1: the free-text block, see the Contact interface above for the source cite.
  notes?: string | null
  // EXTRACT-1: the shared raw shape (src/lib/backofficeLink).
  backoffice_links?: ApiBackofficeLink[]
  // ARCHIVE-SUBENTITY-1: derived boolean + the raw timestamp (CustomerContactResource).
  archived?: boolean; deleted_at?: string | null
  [k: string]: unknown
}

/** Raw API department (read defensively). */
export interface ApiDepartment {
  id?: Id; reference_number?: string; name?: string; description?: string
  location_id?: Id; locationId?: Id; location_name?: string; location?: { name?: string }; locationName?: string
  departments?: ApiDepartment[]; contacts?: ApiContact[]
  // Kostenplaats (Danny 2026-07-22) — the middle cascade level. billing_email
  // joined it (K-249 C.4): the match billing resolver reads a department's own too.
  cost_center?: string; billing_email?: string
  status?: ApiStatusRef | null; status_id?: Id | null
  custom_fields?: Record<string, unknown>
  // EXTRACT-1: the shared raw shape (src/lib/backofficeLink).
  backoffice_links?: ApiBackofficeLink[]
  // SUBENTITEIT-DELETE-1: index-only flag (CustomerDepartmentResource.php:35).
  in_use?: boolean
  // ARCHIVE-SUBENTITY-1: derived boolean + the raw timestamp (CustomerDepartmentResource).
  archived?: boolean; deleted_at?: string | null
  [k: string]: unknown
}

/** Raw API location (read defensively). The BE field is `postcode` (not `postal_code`). */
export interface ApiLocation {
  id?: Id; reference_number?: string; name?: string; street?: string; house_number?: string; house_number_suffix?: string
  postcode?: string; postal_code?: string; city?: string; state?: string; country?: string; coc_number?: string; vat_number?: string
  contact_name?: string; phone?: string; email?: string
  cost_center?: string; billing_email?: string
  // LOCATIE-OMSCHRIJVING-1 (Danny 02-08): free company text, same shape as customers.description.
  description?: string
  // K4BLOGO: signed download URL, freshly minted on every read — never a stored path.
  logo_url?: string | null
  branch_ids?: Id[]; branches?: { id?: Id; name?: string }[]
  branch_inherited?: boolean; effective_branches?: { id?: Id; name?: string }[]
  departments?: ApiDepartment[]; contacts?: ApiContact[]
  status?: ApiStatusRef | null; status_id?: Id | null
  custom_fields?: Record<string, unknown>
  // EXTRACT-1: the shared raw shape (src/lib/backofficeLink).
  backoffice_links?: ApiBackofficeLink[]
  // SUBENTITEIT-DELETE-1: index-only flag (CustomerLocationResource.php:66).
  in_use?: boolean
  // ARCHIVE-SUBENTITY-1: derived boolean + the raw timestamp (CustomerLocationResource).
  archived?: boolean; deleted_at?: string | null
  [k: string]: unknown
}

/** Raw API customer (read defensively). */
export interface ApiCustomer {
  id?: Id; reference_number?: string; name?: string; debtor_number?: string; debtorNumber?: string
  branch?: { id?: Id; name?: string } | null; branch_id?: Id | null; branch_name?: string
  status?: { value?: string | number; label?: string; color?: string } | string | number
  status_id?: string | number; status_label?: string; status_color?: string
  // KLANT-FASE-1: bare lifecycle-phase slug on both the list and detail resource.
  // Null-safe on the backend, so it may legitimately arrive as null.
  phase?: string | null
  owner?: { id?: Id; name?: string; avatar_color?: string | null }
  account_manager?: string; owner_name?: string; owner_id?: Id; owner_color?: string | null
  // KLANT-ADRES-1 / KLANT-KVK-1: the customer's own address + head registration
  // (CustomerDetailResource, delivered 28-07). `postcode` is the BE name, not postal_code.
  street?: string; house_number?: string; house_number_suffix?: string
  postcode?: string; postal_code?: string; state?: string; country?: string
  coc_number?: string; vat_number?: string
  city?: string; industry?: { name?: string } | string; website?: string
  // JOB-CONTACT-1: the customer's own contact fields (CustomerDetailResource).
  email?: string; phone?: string
  // STRAAL-1: geocoded coordinates + radius distance from the server.
  lat?: number; lng?: number; distance_km?: number
  employee_count?: string | number; employeeCount?: string | number
  tone_of_voice?: string; toneOfVoice?: string; description?: string
  recruitment_problems?: string; recruitmentProblems?: string
  hide_company_name?: unknown; has_career_page?: unknown
  show_in_my_vacancies?: unknown; exclude_from_sourcing?: unknown
  // Kostenplaats + facturatie-email at the customer level (Danny 2026-07-22).
  cost_center?: string; billing_email?: string
  tags?: unknown[]
  locations?: ApiLocation[]; departments?: ApiDepartment[]; contacts?: ApiContact[]; contact_persons?: ApiContact[]
  // CONTACT-NOTITIES-1: the contactpersoon a note is filed against (CustomerDetailResource.php:158-163).
  // NOTES-LOC-DEPT-1: the OPTIONAL location/department link + the backend's resolved `level`.
  notes?: Array<{
    id?: Id; type?: string; title?: string; text?: string; body?: string; created_at?: string; ago?: string
    customer_contact_id?: Id | null; contact_name?: string | null
    customer_location_id?: Id | null; location_name?: string | null
    customer_department_id?: Id | null; department_name?: string | null
    level?: string
  }>
  // K17: embedded event-typed timeline (CustomerDetailResource, once CMBE ships
  // it) — same raw shape as the candidate's own `timeline[]` (time/created_at +
  // text/description per event).
  timeline?: Array<Record<string, unknown>>
  locations_count?: number; departments_count?: number; contacts_count?: number
  open_vacancies_count?: number; openVacanciesCount?: number
  active_matches_count?: number; activeMatchesCount?: number
  created_at?: string; created?: string
  logo?: string | null; logo_url?: string | null
  koios_advice?: { action?: string; label?: string; reason?: string; source?: string } | null
  koiosAdvice?: { action?: string; label?: string; reason?: string; source?: string } | null
  // Tenant custom-field values (§3B "Eigen velden").
  custom_fields?: Record<string, unknown>
  // EXTRACT-1: the shared raw shape (src/lib/backofficeLink).
  backoffice_links?: ApiBackofficeLink[]
  // TRASH-OVERAL-2: soft-delete stamp + the two-step trash lifecycle fields the
  // list resource now carries ('active'|'archived'|'pending_erase' + ISO stamp).
  deleted_at?: string | null
  lifecycle?: string
  pending_erase_at?: string | null
  [k: string]: unknown
}
