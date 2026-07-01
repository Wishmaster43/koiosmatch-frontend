/**
 * Customer shapes — the UI models (Customer + nested Location/Department/Contact)
 * and the raw API records, read defensively by the mappers in mapCustomer.js.
 * Status/industry arrive either as a scalar or a { value/label/color|name } object.
 */
import type { Id } from './common'

/** A contact person (flat UI shape). */
export interface Contact {
  id: Id | undefined
  name: string
  role: string
  email: string
  phone: string
  isPrimary: boolean
  locationId: Id | null
  locationName: string
  departmentId: Id | null
  departmentName: string
}

/** A department nested under a location (flat UI shape). */
export interface Department {
  id: Id | undefined
  name: string
  description: string
  locationId: Id | null
  locationName: string
  contacts: Contact[]
}

/** A customer location with C-6 address fields (flat UI shape). */
export interface Location {
  id: Id | undefined
  name: string
  street: string
  houseNumber: string
  houseNumberSuffix: string
  postalCode: string
  city: string
  country: string
  cocNumber: string
  vatNumber: string
  contactName: string
  phone: string
  email: string
  address: string
  departments: Department[]
  contacts: Contact[]
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

/** Raw API contact (read defensively). */
export interface ApiContact {
  id?: Id; name?: string; function?: string; role?: string; email?: string; phone?: string
  is_primary?: unknown; isPrimary?: unknown
  location_id?: Id; locationId?: Id; location_name?: string; location?: { name?: string }
  department_id?: Id; departmentId?: Id; department_name?: string; department?: { name?: string }
  [k: string]: unknown
}

/** Raw API department (read defensively). */
export interface ApiDepartment {
  id?: Id; name?: string; description?: string
  location_id?: Id; locationId?: Id; location_name?: string; location?: { name?: string }; locationName?: string
  departments?: ApiDepartment[]; contacts?: ApiContact[]
  [k: string]: unknown
}

/** Raw API location (read defensively). */
export interface ApiLocation {
  id?: Id; name?: string; street?: string; house_number?: string; house_number_suffix?: string
  postal_code?: string; city?: string; country?: string; coc_number?: string; vat_number?: string
  contact_name?: string; phone?: string; email?: string
  departments?: ApiDepartment[]; contacts?: ApiContact[]
  [k: string]: unknown
}

/** Raw API customer (read defensively). */
export interface ApiCustomer {
  id?: Id; name?: string; debtor_number?: string; debtorNumber?: string
  status?: { value?: string | number; label?: string; color?: string } | string | number
  status_id?: string | number; status_label?: string; status_color?: string
  owner?: { id?: Id; name?: string; avatar_color?: string | null }
  account_manager?: string; owner_name?: string; owner_id?: Id; owner_color?: string | null
  city?: string; industry?: { name?: string } | string; website?: string
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
