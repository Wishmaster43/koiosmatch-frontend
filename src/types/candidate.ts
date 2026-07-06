/**
 * Candidate shapes — the UI model the app renders (`Candidate`, produced by
 * mapCandidate) and the raw API record the backend returns (`ApiCandidate`, read
 * defensively: snake_case with many optional/alternative field names).
 *
 * Relation items (experiences, documents, …) keep an index signature because the
 * backend shape varies by version and mapCandidate spreads them through verbatim;
 * the precise per-tab shapes get tightened when those tabs migrate to TS.
 */

import type { Id, Loose } from './common'
export type { Loose }

/** A tenant-defined custom field definition (GET /custom-fields?entity_type=candidate). */
export interface CandidateCustomFieldDef {
  id: string | number
  key: string
  label: string
  label_i18n?: Record<string, string>
  type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'textarea'
  options?: string[]
  required_for?: string[]
  sort_order: number
  active: boolean
  has_data: boolean
}

/** Server-wide candidate stats (/candidates/stats) — totals across the filtered set. */
export interface CandidateStats {
  by_status?: Array<{ value?: string; status?: string; count?: number }>
  by_funnel?: Array<{ value?: string; funnel_type?: string; label?: string; color?: string; count?: number }>
  by_owner?: Array<{ id?: Id; owner_id?: Id; name?: string; count?: number }>
  attention?: { stale_6m?: number; never_contacted?: number; tasks?: number; no_followup_planned?: number; missing_appointment?: number; intake_planned?: number }
  // Server-side filter options: every value in use across the tenant.
  sources?: string[]
  function_titles?: string[]
  [k: string]: unknown
}

/** Koios AI advice precomputed server-side (background job). */
export interface CandidateAdvice {
  action?: string
  label?: string
  reason?: string
  score?: number
  pool_hint?: string
  [k: string]: unknown
}

/** Talent-pool chip on a candidate. Accepts a bare slug (normalised to { name }). */
export interface CandidatePool {
  id?: string | number
  name?: string
  color?: string
  source?: string
  [k: string]: unknown
}

/** A branch the candidate is linked to (C-4, M2M). Accepts a bare name (→ { name }). */
export interface CandidateBranch {
  id?: string | number
  name?: string
  [k: string]: unknown
}

/** Channel consent (AVG): per-channel opt-in flag + the moment it was recorded.
 * Backend contract (C-11): nested under `consent`; WhatsApp/e-mail default true
 * (operational opt-out), newsletter false (opt-in). `_consent_at` is server-stamped. */
export interface CandidateConsent {
  whatsapp_opt_in: boolean
  email_opt_in: boolean
  newsletter_opt_in: boolean
  whatsapp_consent_at: string | null
  email_consent_at: string | null
  newsletter_consent_at: string | null
}

/** A linked match (read-only on the candidate; the contract lives in HelloFlex). */
export interface CandidateMatch {
  id?: Id
  vacancyId?: Id | null
  vacancyTitle: string
  vacancyUrl?: string | null
  client: string
  score: number | null
  stage: string | null
  stageColor: string | null
  contractStatus: string | null
  createdAt: string | null
  [k: string]: unknown
}

/** The UI candidate model — every consumer relies on this shape. */
export interface Candidate {
  id: string | number
  name: string
  firstname?: string
  lastname?: string
  middleName?: string
  initials: string
  title: string
  candidateTypes: string[]
  stage: string
  stageLabel: string | null
  stageColor: string | null
  stageVacancyId: string | number
  phase: string
  status: string
  statusReason: string | null
  statusReturnDate: string | null
  statusChangedAt: string | null
  // "By whom" the status changed — shown in the header info line once the API sends it (H2).
  statusChangedBy: string | null
  blacklistReason: string | null
  availability: string | null
  owner: string
  ownerId: string | number | null
  ownerColor: string | null
  ownerInitials: string
  city: string
  // STRAAL-1: geocoded coordinates + radius-query distance (null until geocoded).
  lat: number | null
  lng: number | null
  distanceKm: number | null
  province: string
  lastContactAt: string | null
  lastContactDate: string | null
  lastContactType: string | null
  lastContactBy: string | null
  source?: string | null
  client: string
  created: string
  email: string
  phone: string
  street: string
  houseNumber: string
  houseNumberSuffix: string
  postalCode: string
  address: string
  gender: string
  nationality: string
  dob: string
  placeOfBirth: string
  linkedin: string
  photoUrl: string | null
  photo?: string
  summary: string
  tags: string[]
  archived: boolean
  // Archive audit (ARCH-2): when / by whom / why — feeds the drawer's archived banner.
  archivedAt: string | null
  archivedBy: string | null
  archiveReason: string | null
  // Inconsistency flag (§3B): at a requires_appointment stage but none planned.
  missingAppointment: boolean
  branches: CandidateBranch[]
  pools: CandidatePool[]
  koiosAdvice: CandidateAdvice | null
  experiences: Loose[]
  educations: Loose[]
  languages: Loose[]
  certifications: Loose[]
  skills: string[]
  documents: Loose[]
  applications: Loose[]
  matches: CandidateMatch[]
  notes: Loose[]
  timeline: Loose[]
  preferences: Loose
  zzp: Loose
  planningSettings: Loose
  consent: CandidateConsent
  customFields: Record<string, unknown>
  matchesCount: number
  applicationsCount: number
  shiftsCount: number | undefined
  hoursWorked: number | undefined
}

/** A raw match item as the API nests it under candidate.matches. */
export interface ApiCandidateMatch {
  vacancyTitle?: string
  vacancy?: { id?: Id; title?: string; url?: string }
  vacancy_id?: Id
  vacancy_title?: string
  vacancyUrl?: string | null
  vacancy_url?: string | null
  client?: string
  customer?: { name?: string }
  client_name?: string
  score?: number | null
  match_score?: number | null
  stageLabel?: string | null
  stage?: string | null
  stageColor?: string | null
  stage_color?: string | null
  contract_status?: string | null
  contractStatus?: string | null
  created_at?: string | null
  createdAt?: string | null
  [k: string]: unknown
}

/** Raw API candidate record (read defensively by mapCandidate). */
export interface ApiCandidate {
  id?: string | number
  name?: string
  full_name?: string
  firstname?: string
  lastname?: string
  first_name?: string
  last_name?: string
  function_title?: string
  title?: string
  candidate_types?: unknown
  candidate_type?: unknown
  employment_type?: unknown
  type?: unknown
  funnel_type?: string
  stage?: string
  lifecycle?: string
  funnel_label?: string | null
  funnel_color?: string | null
  funnel_vacancy_id?: string | number
  stage_vacancy_id?: string | number
  vacancy_id?: string | number
  phase?: string
  deployability?: string
  status?: string
  status_reason?: string | null
  status_return_date?: string | null
  status_changed_at?: string | null
  status_effective_from?: string | null
  blacklist_reason?: string | null
  blacklisted_by?: string | { name?: string } | null
  blacklisted_at?: string | null
  availability?: string | null
  owner?: { id?: string | number; name?: string; avatar_color?: string }
  recruiter?: { name?: string; avatar_color?: string }
  owner_name?: string
  owner_id?: string | number
  owner_avatar_color?: string
  city?: string
  province?: string
  last_contact_at?: string | null
  last_contacted_at?: string | null
  // STRAAL-1: geocoded coordinates + radius distance from the server.
  lat?: number
  lng?: number
  distance_km?: number
  last_contact?: { date?: string | null; type?: string | null }
  last_contact_type?: string | null
  client?: { name?: string }
  customer?: { name?: string }
  client_name?: string
  created_at?: string
  created?: string
  email?: string
  phone?: string
  mobile?: string
  street?: string
  house_number?: string
  house_number_suffix?: string
  house_number_addition?: string
  postal_code?: string
  address?: string
  gender?: string
  sex?: string
  nationality?: string
  date_of_birth?: string
  dob?: string
  birthdate?: string
  place_of_birth?: string
  placeOfBirth?: string
  linkedin?: string
  photo_url?: string | null
  photoUrl?: string | null
  summary?: string
  bio?: string
  tags?: string[]
  deleted_at?: string | null
  archived?: boolean
  missing_appointment?: boolean | null
  branches?: Array<CandidateBranch | string>
  pools?: Array<CandidatePool | string>
  koios_advice?: Loose | null
  koiosAdvice?: Loose | null
  experiences?: Loose[]
  work_experience?: Loose[]
  educations?: Loose[]
  education?: Loose[]
  languages?: Loose[]
  certifications?: Loose[]
  skills?: string[]
  documents?: Loose[]
  applications?: Loose[]
  matches?: ApiCandidateMatch[]
  notes?: Loose[]
  timeline?: Loose[]
  custom_fields?: Record<string, unknown>
  preferences?: Loose
  zzp?: Loose
  planning_settings?: Loose
  consent?: {
    whatsapp_opt_in?: boolean
    email_opt_in?: boolean
    newsletter_opt_in?: boolean
    whatsapp_consent_at?: string | null
    email_consent_at?: string | null
    newsletter_consent_at?: string | null
  }
  stats?: { matches_count?: number; applications_count?: number; shifts_count?: number; hours_worked?: number }
  [k: string]: unknown
}
