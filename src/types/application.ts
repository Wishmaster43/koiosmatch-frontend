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

/** The flat application model rendered by the table/board. */
export interface Application {
  id: Id | undefined
  candidateId: Id | null
  candidateName: string
  candidateInitials: string
  vacancyId: Id | null
  vacancyTitle: string
  client: string
  score: number | null
  task: string
  phaseKey: string
  bucket: string
  source: string
  owner: ApplicationOwner
  candidateStatusLabel: string
  candidateStatusColor: string
  created: string
  isNew: boolean
  // Detached (soft-deleted) — the row is kept server-side but hidden from the
  // active list; true only when the API is asked for `?include_archived=1`.
  archived: boolean
  // Phase label/colour the drawer may carry alongside the stable phaseKey.
  phaseLabel?: string
  phaseColor?: string
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
  appointments: Array<{ id: Id | undefined; type: string; title: string; when: string; with: string; status: string }>
  timeline: Array<{ id: Id | undefined; author: string; initials: string; description: string; ai: boolean; time: string }>
  notes: Array<{ id: Id | undefined; author: string; text: string; time: string }>
  matchCriteria: unknown[]
  matchSummary: string
  matchSource: string
  aiScore: number | null
  // AI reject advice + the prior rejection summary (present once rejected).
  ai?: { advice?: string; advice_reason?: string; auto_reject_eligible?: boolean }
  rejection?: { reason_label?: string; [k: string]: unknown }
}

/** A raw candidate as the API nests it under an application. */
export interface ApiAppCandidate {
  id?: Id; name?: string; first_name?: string; last_name?: string
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
  candidate_status_label?: string
  candidate_status_color?: string
  created_at?: string
  applied_at?: string
  is_new?: boolean
  deleted_at?: string | null
  archived?: boolean
  interviews?: Array<{
    id?: Id; channel?: string; status?: string; created_at?: string; time?: string; summary?: string
    transcript?: Array<{ author?: string; side?: string; time?: string; text?: string }>
  }>
  appointments?: Array<{ id?: Id; type?: string; title?: string; scheduled_at?: string; when?: string; owner?: { name?: string }; with?: string; status?: string }>
  timeline?: Array<{ id?: Id; author?: string; author_initials?: string; description?: string; ai?: unknown; created_at?: string; time?: string }>
  notes?: Array<{ id?: Id; author?: string; text?: string; created_at?: string }>
  match_criteria?: unknown[]
  match_summary?: string
  match_score_source?: string
  ai_match_score?: number | null
  [k: string]: unknown
}

export type { Loose }
