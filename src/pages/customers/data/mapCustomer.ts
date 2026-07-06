import { initialsOf } from '@/lib/initials'
import type { Id } from '@/types/common'
import type {
  ApiContact, ApiDepartment, ApiLocation, ApiCustomer,
  Contact, Department, Location, Customer,
} from '@/types/customer'

// Compact one-line address: "Straat 12a, 1234 AB Plaats".
const addressLine = (l: ApiLocation = {}): string => {
  const street = [l.street, l.house_number].filter(Boolean).join(' ') + (l.house_number_suffix ? l.house_number_suffix : '')
  const city = [l.postal_code, l.city].filter(Boolean).join(' ')
  return [street.trim(), city.trim()].filter(Boolean).join(', ')
}

/** mapDepartment — raw API department → flat UI shape (nested under a location). */
export function mapDepartment(d: ApiDepartment = {}): Department {
  return {
    id: d.id,
    name: d.name ?? '—',
    description: d.description ?? '',
    locationId: d.location_id ?? d.locationId ?? null,
    locationName: d.location_name ?? d.location?.name ?? d.locationName ?? '',
    contacts: (d.contacts ?? []).map(mapContact),
  }
}

/** mapContact — raw API contact person → flat UI shape. */
export function mapContact(p: ApiContact = {}): Contact {
  return {
    id: p.id,
    name: p.name ?? '—',
    role: p.function ?? p.role ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    isPrimary: Boolean(p.is_primary ?? p.isPrimary),
    locationId: p.location_id ?? p.locationId ?? null,
    locationName: p.location_name ?? p.location?.name ?? '',
    departmentId: p.department_id ?? p.departmentId ?? null,
    departmentName: p.department_name ?? p.department?.name ?? '',
  }
}

/** mapLocation — raw API location → flat UI shape with C-6 address fields. */
export function mapLocation(l: ApiLocation = {}): Location {
  const departments = (l.departments ?? []).map(mapDepartment)
  const contacts = (l.contacts ?? []).map(mapContact)
  return {
    id: l.id,
    name: l.name ?? '—',
    street: l.street ?? '',
    houseNumber: l.house_number ?? '',
    houseNumberSuffix: l.house_number_suffix ?? '',
    postalCode: l.postal_code ?? '',
    city: l.city ?? '',
    country: l.country ?? '',
    cocNumber: l.coc_number ?? '',
    vatNumber: l.vat_number ?? '',
    contactName: l.contact_name ?? '',
    phone: l.phone ?? '',
    email: l.email ?? '',
    address: addressLine(l),
    departments,
    contacts,
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
    name: c.name ?? '—',
    initials: initialsOf(c.name),
    debtorNumber: c.debtor_number ?? c.debtorNumber ?? '',
    status: statusValue,
    statusLabel: (status && typeof status === 'object') ? status.label : c.status_label,
    statusColor: (status && typeof status === 'object') ? status.color : c.status_color,
    owner: owner.name ?? c.account_manager ?? c.owner_name ?? '',
    ownerId: owner.id ?? c.owner_id ?? null,
    ownerInitials: initialsOf(owner.name ?? c.account_manager ?? c.owner_name ?? ''),
    ownerColor: owner.avatar_color ?? c.owner_color ?? null,
    city: c.city ?? '',
    // STRAAL-1: geocoded coordinates + radius distance from the server.
    lat: typeof c.lat === 'number' ? c.lat : null,
    lng: typeof c.lng === 'number' ? c.lng : null,
    distanceKm: typeof c.distance_km === 'number' ? c.distance_km : null,
    industry: (c.industry && typeof c.industry === 'object') ? (c.industry.name ?? '') : (c.industry ?? ''),
    website: c.website ?? '',
    employeeCount: c.employee_count ?? c.employeeCount ?? '',
    toneOfVoice: c.tone_of_voice ?? c.toneOfVoice ?? '',
    description: c.description ?? '',
    recruitmentProblems: c.recruitment_problems ?? c.recruitmentProblems ?? '',
    privacyPolicyUrl: c.privacy_policy_url ?? c.privacyPolicyUrl ?? '',
    hideCompanyName: Boolean(c.hide_company_name),
    hasCareerPage: Boolean(c.has_career_page),
    showInVacancies: Boolean(c.show_in_my_vacancies),
    excludeFromSourcing: Boolean(c.exclude_from_sourcing),
    tags: c.tags ?? [],
    // Archived = soft-deleted (deleted_at). Off by default in the list; the
    // "Gearchiveerd" view opts in via ?include_archived=1.
    archived: !!(c.deleted_at ?? c.archived),
    locations,
    departments,
    contacts,
    notes: (c.notes ?? []).map(n => ({ id: n.id, type: n.type ?? '', title: n.title ?? '', text: n.text ?? n.body ?? '', ago: n.created_at ?? n.ago ?? '' })),
    locationsCount: c.locations_count ?? locations.length,
    departmentsCount: c.departments_count ?? departments.length,
    contactsCount: c.contacts_count ?? contacts.length,
    openVacanciesCount: c.open_vacancies_count ?? c.openVacanciesCount ?? 0,
    activeMatchesCount: c.active_matches_count ?? c.activeMatchesCount ?? 0,
    created: c.created_at ?? c.created ?? '',
    logo: c.logo ?? c.logo_url ?? null,
    koiosAdvice: c.koios_advice ?? c.koiosAdvice ?? null,
  }
}
