/**
 * Vacancy shapes — the UI models (`Vacancy` for the list, `VacancyDetail` for the
 * drawer) and the raw API record (`ApiVacancy`), read defensively by
 * mapVacancy / mapVacancyDetail (the /vacancies endpoint is still settling).
 */
import type { Id, Loose } from './common'

/** Owner/recruiter chip on a vacancy row. */
export interface VacancyOwner {
  id: Id | null
  name: string
  initials: string
  color: string | null
}

/** A raw job-board channel item (used by base + detail). */
export interface ApiChannel {
  value?: string | number
  // CHANNEL-ICON-1: the stable machine key + icon name so the FE maps publish
  // icons exactly (channelIcons.ts), never a heuristic on the editable label.
  key?: string | number
  icon?: string
  id?: Id
  label?: string
  name?: string
  published?: unknown
}

/** The flat vacancy model rendered by the list/table. */
export interface Vacancy {
  id: Id | undefined
  code: string
  // NUMMER-1: human-readable reference number (V-12) — distinct from the manual `code`.
  referenceNumber?: string
  title: string
  statusValue: string | number | null
  statusLabel: string
  statusColor: string
  leadsCount: number
  applicationsCount: number
  applicationsByPhase: Loose
  published: boolean
  publishedChannels: unknown[]
  owner: VacancyOwner
  clientId: Id | null
  clientName: string
  tags: unknown[]
  created: string
  createdSort: string
  // City + STRAAL-1 geo: the map view plots list rows (null until the API sends them).
  city: string
  lat: number | null
  lng: number | null
  distanceKm: number | null
  // VAC-DATES-1: the vacancy's own runtime window (YYYY-MM-DD, native <input type="date">
  // shape) — present on both the list AND detail resource, so it lives on the base row.
  startDate: string
  endDate: string
  // Archive state (soft-delete) — mirrors the candidate's archived/archivedAt pair so
  // the table can render the same soft "Gearchiveerd" chip when include_archived=1.
  archived: boolean
  archivedAt: string | null
}

/** The enriched vacancy model rendered by the drawer tabs. */
export interface VacancyDetail extends Vacancy {
  // Raw lookup slugs, so the Details tab can edit in-place (bind a select to the
  // value, resolve the label for read mode). Display labels (seniority/education)
  // stay for the read view.
  seniorityValue: string
  educationValue: string
  // Contract forms this vacancy offers — same lookup as the candidate (multi-value).
  contractTypes: string[]
  // Structured address (edited as separate fields, shown as one composed line).
  street: string
  houseNumber: string
  houseNumberSuffix: string
  postalCode: string
  province: string
  // Experience range in years (from–to).
  experienceMin: string
  experienceMax: string
  salaryMin: string
  salaryMax: string
  hoursMin: string
  hoursMax: string
  location: string
  salary: string
  hours: string
  experience: string
  seniority: string
  education: string
  industry: string
  category: string
  skills: unknown[]
  description: string
  applicationSettings: Loose
  matchWeights: Loose
  // MATCH-TEMPLATE-1: provenance only — which template these weights were last
  // snapshotted from (null = never assigned / cleared by a manual override).
  matchWeightTemplateId: string | null
  // VAC-CASCADE-1: klant → locatie → afdeling → contactpersoon — ids for the in-place
  // editor's pickers, resolved display names for read-mode (seeded from the detail so
  // a saved pick still shows after a reload, and cancel reverts to these).
  customerLocationId: string
  customerLocationName: string
  customerDepartmentId: string
  customerDepartmentName: string
  contactId: string
  contactName: string
  channels: Array<{ value: string | number | undefined; label: string; published: boolean; key?: string; icon?: string }>
  applications: Array<{
    id: Id | undefined; candidateId: Id | null; candidateName: string; candidateInitials: string
    phaseValue: string | number | null; phaseLabel: string; phaseColor: string; source: string; created: string
  }>
  customFields: Array<{ id: Id | undefined; name: string; value: unknown }>
  // Per-vacancy custom-field values keyed by field key (for the Extra tab).
  customFieldValues: Record<string, unknown>
  documents: Array<{ id: Id | undefined; name: string; size: unknown }>
  timeline: Array<{ id: Id | undefined; author: string; initials: string; description: string; ai: boolean; time: string }>
  notes: Array<{ id: Id | undefined; author: string; text: string; time: string }>
}

/** Raw API vacancy record (read defensively). */
export interface ApiVacancy {
  id?: Id
  code?: string
  reference?: string
  // NUMMER-1: server-assigned human-readable reference number (V-12).
  reference_number?: string
  title?: string
  status?: { value?: string | number; label?: string; color?: string } | string
  // STRAAL-1: geocoded coordinates + radius distance from the server.
  lat?: number; lng?: number; distance_km?: number
  status_value?: string | number
  status_label?: string
  status_color?: string
  leads_count?: number
  leadsCount?: number
  applications_count?: number
  applicationsCount?: number
  applications_by_phase?: Loose
  applicationsByPhase?: Loose
  published?: unknown
  published_channels?: ApiChannel[]
  publishedChannels?: ApiChannel[]
  owner?: { id?: Id; name?: string; avatar_color?: string | null; color?: string | null }
  owner_id?: Id
  owner_name?: string
  customer?: { id?: Id; name?: string }
  client?: { id?: Id; name?: string }
  customer_id?: Id
  client_id?: Id
  customer_name?: string
  client_name?: string
  tags?: unknown[]
  created_at?: string
  createdAt?: string
  // VAC-DATES-1: the vacancy's own runtime window (both list + detail resources).
  start_date?: string | null
  end_date?: string | null
  // Archive state (soft-delete) — VacancyListResource always sends both.
  archived?: boolean
  deleted_at?: string | null
  // detail
  employment_type?: unknown
  employment_type_label?: string
  contract_types?: string[]
  street?: string
  house_number?: string
  house_number_suffix?: string
  postcode?: string
  postal_code?: string
  city?: string
  province?: string
  experience_min_years?: number | string | null
  experience_max_years?: number | string | null
  location?: string
  salary?: string
  salary_min?: number | string | null
  salary_max?: number | string | null
  salary_period?: string
  hours?: string
  hours_min?: number | string | null
  hours_max?: number | string | null
  hours_unit?: string
  experience?: string
  experience_years?: number | null
  seniority?: unknown
  seniority_label?: string
  education?: unknown
  education_label?: string
  industry?: unknown
  industry_label?: string
  function?: unknown
  category?: string
  function_title?: string
  skills?: unknown[]
  description?: string
  application_settings?: Loose
  match_weights?: Loose
  // MATCH-TEMPLATE-1: which template the current match_weights snapshot came from.
  match_weight_template_id?: string | null
  channels?: ApiChannel[]
  applications?: Array<{
    id?: Id; candidate?: { id?: Id; name?: string; initials?: string }; candidate_name?: string; candidate_id?: Id
    phase?: { value?: string | number; label?: string; color?: string }; phase_key?: string; stage?: string
    phase_label?: string; phase_color?: string; source?: string; created_at?: string
  }>
  custom_fields?: Array<{ id?: Id; name?: string; label?: string; value?: unknown }>
  documents?: Array<{ id?: Id; name?: string; size?: unknown }>
  timeline?: Array<{ id?: Id; author?: string; author_initials?: string; description?: string; ai?: unknown; created_at?: string; time?: string }>
  notes?: Array<{ id?: Id; author?: string; text?: string; created_at?: string }>
  // VAC-CASCADE-1: klant → locatie → afdeling → contactpersoon — ids + resolved {id,name}.
  customer_location_id?: Id
  customer_location?: { id?: Id; name?: string } | null
  customer_department_id?: Id
  customer_department?: { id?: Id; name?: string } | null
  contact_id?: Id
  contact?: { id?: Id; name?: string } | null
  [k: string]: unknown
}
