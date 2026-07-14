/**
 * Customer shapes — the UI models (Customer + nested Location/Department/Contact)
 * and the raw API records, read defensively by the mappers in mapCustomer.js.
 * Status/industry arrive either as a scalar or a { value/label/color|name } object.
 */
import type { Id } from './common'

/** A contact person (flat UI shape). SUB-STATUS-1 status + CONTACT-MULTI-1 single coupling (chip UI, multi later). */
export interface Contact {
  id: Id | undefined
  firstName: string
  lastName: string
  name: string
  role: string
  email: string
  phone: string
  isPrimary: boolean
  locationId: Id | null
  locationName: string
  departmentId: Id | null
  departmentName: string
  statusId: Id | null
  status: string
  statusLabel: string
  statusColor: string
  customFields: Record<string, unknown>
}

/** A department nested under a location (flat UI shape). SUB-STATUS-1: lifecycle status. */
export interface Department {
  id: Id | undefined
  // NUMMER-1: human-readable reference number (A-001).
  referenceNumber?: string
  name: string
  description: string
  locationId: Id | null
  locationName: string
  contacts: Contact[]
  statusId: Id | null
  status: string
  statusLabel: string
  statusColor: string
  customFields: Record<string, unknown>
}

/** A customer location with C-6 address fields (flat UI shape). SUB-STATUS-1: lifecycle status. */
export interface Location {
  id: Id | undefined
  // NUMMER-1: human-readable reference number (L-001).
  referenceNumber?: string
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
  isHeadquarter: boolean
  costCenter: string
  billingEmail: string
  address: string
  departments: Department[]
  contacts: Contact[]
  statusId: Id | null
  status: string
  statusLabel: string
  statusColor: string
  customFields: Record<string, unknown>
}

/** A customer note (flat UI shape). */
export interface CustomerNote {
  id: Id | undefined
  type: string
  title: string
  text: string
  ago: string
  // Loose backend note shape — keeps it compatible with the shared NotesTab item.
  [k: string]: unknown
}

/** The flat customer model rendered by the table/insights/drawer. */
export interface Customer {
  id: Id | undefined
  // NUMMER-1: human-readable reference number (D-4). Tenant-configurable
  // prefix/padding/start (Settings → Nummering); server-assigned, immutable.
  referenceNumber?: string
  name: string
  initials: string
  debtorNumber: string
  status: string | number
  statusLabel: string | undefined
  statusColor: string | undefined
  owner: string
  ownerId: Id | null
  ownerInitials: string
  ownerColor: string | null
  city: string
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
  privacyPolicyUrl: string
  hideCompanyName: boolean
  hasCareerPage: boolean
  showInVacancies: boolean
  excludeFromSourcing: boolean
  tags: unknown[]
  archived: boolean
  locations: Location[]
  departments: Department[]
  contacts: Contact[]
  notes: CustomerNote[]
  locationsCount: number
  departmentsCount: number
  contactsCount: number
  openVacanciesCount: number
  activeMatchesCount: number
  created: string
  logo: string | null
  koiosAdvice: { action?: string; label?: string; reason?: string } | null
}

/** A tenant lookup status as embedded on a location/department/contact (SUB-STATUS-1). */
export interface ApiStatusRef { value?: string; label?: string; color?: string }

/** Raw API contact (read defensively). CustomerContactResource sends first_name/last_name + a composed `name`. */
export interface ApiContact {
  id?: Id; first_name?: string; last_name?: string; name?: string; function?: string; role?: string; email?: string; phone?: string
  is_primary?: unknown; isPrimary?: unknown
  // The BE field is `customer_location_id` / `customer_department_id`; location_id/locationId tolerated for older payloads.
  customer_location_id?: Id; location_id?: Id; locationId?: Id; location_name?: string; location?: { name?: string }
  customer_department_id?: Id; department_id?: Id; departmentId?: Id; department_name?: string; department?: { name?: string }
  status?: ApiStatusRef | null; status_id?: Id | null
  custom_fields?: Record<string, unknown>
  [k: string]: unknown
}

/** Raw API department (read defensively). */
export interface ApiDepartment {
  id?: Id; reference_number?: string; name?: string; description?: string
  location_id?: Id; locationId?: Id; location_name?: string; location?: { name?: string }; locationName?: string
  departments?: ApiDepartment[]; contacts?: ApiContact[]
  status?: ApiStatusRef | null; status_id?: Id | null
  custom_fields?: Record<string, unknown>
  [k: string]: unknown
}

/** Raw API location (read defensively). The BE field is `postcode` (not `postal_code`). */
export interface ApiLocation {
  id?: Id; reference_number?: string; name?: string; street?: string; house_number?: string; house_number_suffix?: string
  postcode?: string; postal_code?: string; city?: string; state?: string; country?: string; coc_number?: string; vat_number?: string
  contact_name?: string; phone?: string; email?: string
  is_headquarter?: unknown; cost_center?: string; billing_email?: string
  departments?: ApiDepartment[]; contacts?: ApiContact[]
  status?: ApiStatusRef | null; status_id?: Id | null
  custom_fields?: Record<string, unknown>
  [k: string]: unknown
}

/** Raw API customer (read defensively). */
export interface ApiCustomer {
  id?: Id; reference_number?: string; name?: string; debtor_number?: string; debtorNumber?: string
  status?: { value?: string | number; label?: string; color?: string } | string | number
  status_id?: string | number; status_label?: string; status_color?: string
  owner?: { id?: Id; name?: string; avatar_color?: string | null }
  account_manager?: string; owner_name?: string; owner_id?: Id; owner_color?: string | null
  city?: string; industry?: { name?: string } | string; website?: string
  // STRAAL-1: geocoded coordinates + radius distance from the server.
  lat?: number; lng?: number; distance_km?: number
  employee_count?: string | number; employeeCount?: string | number
  tone_of_voice?: string; toneOfVoice?: string; description?: string
  recruitment_problems?: string; recruitmentProblems?: string
  privacy_policy_url?: string; privacyPolicyUrl?: string
  hide_company_name?: unknown; has_career_page?: unknown
  show_in_my_vacancies?: unknown; exclude_from_sourcing?: unknown
  tags?: unknown[]
  locations?: ApiLocation[]; departments?: ApiDepartment[]; contacts?: ApiContact[]; contact_persons?: ApiContact[]
  notes?: Array<{ id?: Id; type?: string; title?: string; text?: string; body?: string; created_at?: string; ago?: string }>
  locations_count?: number; departments_count?: number; contacts_count?: number
  open_vacancies_count?: number; openVacanciesCount?: number
  active_matches_count?: number; activeMatchesCount?: number
  created_at?: string; created?: string
  logo?: string | null; logo_url?: string | null
  koios_advice?: { action?: string; label?: string; reason?: string } | null
  koiosAdvice?: { action?: string; label?: string; reason?: string } | null
  [k: string]: unknown
}
