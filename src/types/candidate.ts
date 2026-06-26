/**
 * Candidate shapes — the UI model the app renders (`Candidate`, produced by
 * mapCandidate) and the raw API record the backend returns (`ApiCandidate`, read
 * defensively: snake_case with many optional/alternative field names).
 *
 * Relation items (experiences, documents, …) keep an index signature because the
 * backend shape varies by version and mapCandidate spreads them through verbatim;
 * the precise per-tab shapes get tightened when those tabs migrate to TS.
 */

/** Loose nested record whose exact fields vary by backend version. */
export type Loose = Record<string, unknown>

/** Talent-pool chip on a candidate. Accepts a bare slug (normalised to { name }). */
export interface CandidatePool {
  id?: string | number
  name?: string
  color?: string
  source?: string
  [k: string]: unknown
}

/** Channel consent (AVG opt-in): per-channel flag + the moment it was given. */
export interface CandidateConsent {
  whatsapp_consent: boolean
  email_consent: boolean
  newsletter_consent: boolean
  whatsapp_consent_at: string | null
  email_consent_at: string | null
  newsletter_consent_at: string | null
}

/** A linked match (read-only on the candidate; the contract lives in HelloFlex). */
export interface CandidateMatch {
  vacancyTitle: string
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
  initials: string
  title: string
  candidateTypes: string[]
  stage: string
  stageLabel: string | null
  stageColor: string | null
  stageVacancyId: string | number
  status: string
  availability: string | null
  owner: string
  ownerId: string | number | null
  ownerColor: string | null
  ownerInitials: string
  city: string
  province: string
  lastContactAt: string | null
  lastContactDate: string | null
  lastContactType: string | null
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
  summary: string
  tags: string[]
  branches: string[]
  pools: CandidatePool[]
  koiosAdvice: Loose | null
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
  matchesCount: number
  applicationsCount: number
  shiftsCount: number | undefined
  hoursWorked: number | undefined
}

/** A raw match item as the API nests it under candidate.matches. */
export interface ApiCandidateMatch {
  vacancyTitle?: string
  vacancy?: { title?: string }
  vacancy_title?: string
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
  status?: string
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
  branches?: string[]
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
  preferences?: Loose
  zzp?: Loose
  planning_settings?: Loose
  whatsapp_consent?: boolean
  email_consent?: boolean
  newsletter_consent?: boolean
  whatsapp_consent_at?: string | null
  email_consent_at?: string | null
  newsletter_consent_at?: string | null
  stats?: { matches_count?: number; applications_count?: number; shifts_count?: number; hours_worked?: number }
  [k: string]: unknown
}
