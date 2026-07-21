/**
 * Application shapes — the UI models (`Application` for the list/board, plus the
 * enriched `ApplicationDetail` for the drawer) and the raw API record
 * (`ApiApplication`), read defensively by mapApplication / mapApplicationDetail.
 */
import type { Id, Loose } from './common'

/** Owner/recruiter chip on an application row. */
export interface ApplicationOwner {
  id: Id | null
  name: string
  initials: string
  color: string | null
}

/**
 * INTERVIEW-PHASE-1: the live AI-interview session's UNIVERSAL category
 * (busy/completed/disqualified — works across flows with different questions)
 * plus its progress within THIS flow's own status list (a Helpende flow may
 * have 3 steps, a Verpleegkundige flow 12). Null = no interview session at all
 * (the backend's `interview_status=none` filter bucket).
 */
export interface ApplicationInterview {
  category: 'busy' | 'completed' | 'disqualified'
  currentStatus: string | null
  step: number | null
  total: number
}

/** The flat application model rendered by the table/board. */
export interface Application {
  id: Id | undefined
  candidateId: Id | null
  candidateName: string
  candidateInitials: string
  vacancyId: Id | null
  vacancyTitle: string
  client: string
  // S12/13: the customer id (the vacancy's client) — drives the Klant EntityLink.
  customerId: Id | null
  // S5: the application's own human-readable display number (e.g. "S-00123").
  referenceNumber: string
  score: number | null
  task: string
  phaseKey: string
  bucket: string
  source: string
  owner: ApplicationOwner
  candidateStatusLabel: string
  candidateStatusColor: string
  // Raw candidate status/phase slugs (when the API exposes them) — let the shared
  // CandidateStatusChip apply the model-v2 rules; empty falls back to label/colour.
  candidateStatus: string
  candidatePhase: string
  created: string
  isNew: boolean
  // Detached (soft-deleted) — the row is kept server-side but hidden from the
  // active list; true only when the API is asked for `?include_archived=1`.
  archived: boolean
  // APP-DELETED-AT-1: the raw timestamp behind `archived` — feeds the drawer's
  // archived banner ("Archived on <date>"); null while active.
  deletedAt: string | null
  // Phase label/colour the drawer may carry alongside the stable phaseKey.
  phaseLabel?: string
  phaseColor?: string
  // INTERVIEW-PHASE-1: the live interview session's category + step progress,
  // null when the candidate has no session at all.
  interview: ApplicationInterview | null
}

/** The enriched application model rendered by the drawer tabs. */
export interface ApplicationDetail extends Application {
  candidate: {
    name: string; initials: string; function: string
    statusLabel: string; statusColor: string
    gender: string; nationality: string; dob: string
    email: string; phone: string; address: string; summary: string
  }
  vacancy: {
    id: Id | null; title: string; client: string; vacancyId: string; status: string
    employmentType: string; location: string; salary: string; hours: string
    experience: string; seniority: string; education: string
    branch: string; category: string; skills: unknown[]; tags: unknown[]
  }
  interviews: Array<{
    id: Id | undefined; channel: string; status: string; date: string; time: string; summary: string
    transcript: Array<{ author: string; side: string; time: string; text: string }>
  }>
  appointments: Array<{
    id: Id | undefined; type: string; title: string; when: string; with: string; status: string
    // Kept RAW (no pre-formatting) so the shared PlanIntakeModal can prefill an edit.
    durationMin: number | null; modality: string; ownerId: Id | null; locationName: string
  }>
  timeline: Array<{ id: Id | undefined; author: string; initials: string; description: string; ai: boolean; time: string }>
  notes: Array<{ id: Id | undefined; author: string; text: string; time: string }>
  matchCriteria: unknown[]
  matchSummary: string
  matchSource: string
  aiScore: number | null
  // AI reject advice + the prior rejection summary (present once rejected).
  ai?: { advice?: string; advice_reason?: string; auto_reject_eligible?: boolean }
  rejection?: { reason_label?: string; [k: string]: unknown }
  // Tenant custom-field values (§3B "Eigen velden" — the drawer's gated Extra tab).
  customFields: Record<string, unknown>
}

/** A raw candidate as the API nests it under an application. */
export interface ApiAppCandidate {
  id?: Id; name?: string; first_name?: string; last_name?: string
  status?: string; phase?: string
  status_label?: string; status_color?: string
  function_title?: string; title?: string
  gender?: string; nationality?: string; date_of_birth?: string; dob?: string
  email?: string; phone?: string; address?: string; city?: string; summary?: string
  initials?: string
  [k: string]: unknown
}

/** A raw vacancy as the API nests it under an application. */
export interface ApiAppVacancy {
  id?: Id; title?: string; client_name?: string; code?: string; reference?: string
  status_label?: string; status?: string; employment_type?: string; location?: string
  salary?: string; hours?: string; experience?: string; seniority?: string; education?: string
  branch?: string; industry?: string; category?: string; skills?: unknown[]; tags?: unknown[]
  [k: string]: unknown
}

/** Raw API application record (read defensively). */
export interface ApiApplication {
  id?: Id
  candidate?: ApiAppCandidate
  candidate_name?: string
  candidate_id?: Id
  vacancy?: ApiAppVacancy
  vacancy_id?: Id
  vacancy_title?: string
  client_name?: string
  client?: { name?: string }
  customer?: { name?: string }
  // S12/13: the customer id (ApplicationListResource: the vacancy's client_id).
  customer_id?: Id | null
  // S5: the application's own reference number (ApplicationListResource).
  reference_number?: string | null
  score?: number | null
  match_score?: number | null
  match?: { overall?: number | null; criteria?: unknown[]; summary?: string }
  task?: string
  ai_task?: string
  ai?: { task?: string }
  phase_key?: string
  stage?: string
  phase?: string
  bucket?: string
  source?: string
  source_name?: string
  owner?: { id?: Id; name?: string; avatar_color?: string | null }
  owner_id?: Id
  owner_name?: string
  candidate_status?: string
  candidate_phase?: string
  candidate_status_label?: string
  candidate_status_color?: string
  created_at?: string
  applied_at?: string
  is_new?: boolean
  deleted_at?: string | null
  archived?: boolean
  // INTERVIEW-PHASE-1: the list contract sends `category` directly
  // (ApplicationListResource::interviewSummary); the detail contract's
  // interview() omits it but sends completed_at/disqualified_reason instead —
  // mapApplication derives category from those when absent. Null = no session.
  interview?: {
    category?: string
    current_status?: string | null
    statuses?: string[]
    step?: number | null
    total?: number
    completed_at?: string | null
    disqualified_reason?: string | null
  } | null
  interviews?: Array<{
    id?: Id; channel?: string; status?: string; created_at?: string; time?: string; summary?: string
    transcript?: Array<{ author?: string; side?: string; time?: string; text?: string }>
  }>
  appointments?: Array<{
    id?: Id; type?: string; title?: string; scheduled_at?: string; when?: string
    duration_min?: number | null; modality?: string; location_name?: string
    owner?: { id?: Id; name?: string }; with?: string; status?: string
  }>
  timeline?: Array<{ id?: Id; author?: string; author_initials?: string; description?: string; ai?: unknown; created_at?: string; time?: string }>
  notes?: Array<{ id?: Id; author?: string; text?: string; created_at?: string }>
  match_criteria?: unknown[]
  match_summary?: string
  match_score_source?: string
  ai_match_score?: number | null
  // Tenant custom-field values (§3B "Eigen velden").
  custom_fields?: Record<string, unknown>
  [k: string]: unknown
}

export type { Loose }
