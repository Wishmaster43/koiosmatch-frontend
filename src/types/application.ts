/**
 * Application shapes — the UI models (`Application` for the list/board, plus the
 * enriched `ApplicationDetail` for the drawer) and the raw API record
 * (`ApiApplication`), read defensively by mapApplication / mapApplicationDetail.
 */
import type { Id, Loose } from './common'

/**
 * APP-STAGE-DURATIONS-1 (landed): one entry per phase the application has
 * passed through — chronological, `leftAt` null on the CURRENT stage. Backs
 * the status strip's real "days in phase" line instead of guessing from the
 * application's created date.
 */
export interface ApplicationStageDuration {
  stageKey: string
  stageLabel: string
  enteredAt: string | null
  leftAt: string | null
  days: number | null
}

/**
 * The linked Match summary (GET /applications/{id} → `match`), null when no
 * Match hangs on this application yet. A Match is the continuation of a
 * Hired application — this is a read-only summary, never the full Match
 * record.
 */
export interface ApplicationMatchSummary {
  id: Id
  referenceNumber: string
  statusLabel: string
  statusColor: string
  matchStart: string | null
  matchEnd: string | null
}

/** Owner/recruiter chip on an application row. */
export interface ApplicationOwner {
  id: Id | null
  name: string
  initials: string
  color: string | null
}

/**
 * INTERVIEW-PHASE-1: the live AI-interview session's UNIVERSAL category
 * (busy/completed/disqualified/paused — works across flows with different
 * questions) plus its progress within THIS flow's own status list (a Helpende
 * flow may have 3 steps, a Verpleegkundige flow 12). Null = no interview
 * session at all (the backend's `interview_status=none` filter bucket).
 *
 * INTERVIEW-VISIBILITY-1 (speculative, Danny 21-07): `id`/`agent`/`flowName`/
 * `turn`/timing fields are awaiting CMBE's confirmed contract — today's real
 * ApplicationDetailResource::interviewSession() sends none of them, so they
 * stay nullable and default to null. The UI honest-gates on their absence
 * rather than assuming a fake value (§3).
 *
 * INTERVIEW-STOP-1 (Danny 22-07): `paused` is the category a session moves to
 * once a recruiter stops the agent (`POST /applications/{id}/stop-interview`);
 * `pausedAt`/`pausedBy` record when/who — both nullable until that ships.
 */
export interface ApplicationInterview {
  category: 'busy' | 'completed' | 'disqualified' | 'paused'
  currentStatus: string | null
  step: number | null
  total: number
  // The interview session's own id — awaited from INTERVIEW-SESSION-ID-AGENT;
  // the stop/resume actions honest-gate on its presence rather than assume it.
  id: Id | null
  agent: { id: Id; name: string } | null
  flowName: string | null
  // 'completed' is the backend's 'afgerond': nobody is on turn any more because the
  // interview is finished. Normalised in mapInterview — see the alias table there.
  turn: 'agent' | 'candidate' | 'completed' | 'pending' | 'recruiter' | null
  startedAt: string | null
  lastMessageAt: string | null
  endedAt: string | null
  durationSeconds: number | null
  pausedAt: string | null
  pausedBy: { id: Id; name: string } | null
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
  // APP-STAGE-DURATIONS-1: the LIST contract's own timestamp for when the
  // application entered its current phase — the status strip computes days
  // from this when the richer `stageDurations` detail array isn't loaded yet.
  currentStageEnteredAt: string | null
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
  // Rejection trail — ApplicationDetailResource::rejection() sends all five
  // fields once rejected; channel/sent_at were dropped on the floor before
  // (RejectionSummary now renders them), so they are typed properly here
  // rather than escaping through the old index signature.
  rejection?: { reason_id?: Id; reason_label?: string; note?: string; channel?: string; sent_at?: string | null }
  // Tenant custom-field values (§3B "Eigen velden" — the drawer's gated Extra tab).
  customFields: Record<string, unknown>
  // MOTIVATIE-ZICHTBAAR-1 (landed): the applicant's motivation letter
  // (applications.cover_letter), emitted HTML-sanitised by ApplicationDetailResource
  // — DETAIL CONTRACT ONLY, ApplicationListResource omits it, so the table/board
  // cannot show it. Legitimately null on most rows: only the public careersite apply
  // and the partner API ever write it (recruiter create/PATCH do not accept it), and
  // a vacancy with app_cover_letter = HIDDEN drops it at validation. The server may
  // also send '' (a letter that stripped to nothing) — gate on truthiness, never
  // on `!== null`.
  coverLetter: string | null
  // INTERVIEW-CONSENT-PERSIST-1 (LIVE — nothing awaited): ApplicationDetailResource
  // always sends this, as an ISO-8601 timestamp or null. It is a WHEN, not a boolean:
  // never treat presence as a checkbox without formatting the date. Only the PUBLIC
  // careersite apply writes it (CareerApplicationHandler); coupling an existing
  // candidate inside Koios and the external partner-site channel never do, and even
  // on the careersite the vacancy's `application_settings.interview_consent` can be
  // `hidden` or simply left unticked. So null means "no consent recorded" and NEVER
  // "consent refused" — the drawer renders its AVG evidence row only when non-null
  // rather than asserting an absence it cannot substantiate.
  interviewConsentGivenAt: string | null
  // CONTACT-PERSON-1 (LIVE — nothing awaited): ApplicationDetailResource always sends
  // this key (detail contract only). It is DERIVED, never owned by the application:
  // the resource resolves it through the LINKED VACANCY's contact_id (Vacancy::contact
  // → CustomerContact), so it is READ-ONLY here — UpdateApplicationRequest has no
  // contact field, so PATCH /applications/{id} with contact_id is dropped. Editing it
  // means PATCH /vacancies/{id} { contact_id } (the vacancy DetailsTab cascade, also
  // reachable from this drawer's Vacature tab), which needs vacancies.update rather
  // than applications.update — a contact picker on the application would be a fake
  // affordance (§3). Null is a NORMAL state: no vacancy linked, the vacancy's
  // contact_id unset (no seeder sets one, so demo data always shows the dash), or the
  // CustomerContact was hard-deleted (no SoftDeletes) leaving a dangling id. `name` is
  // a server-side trim of first+last name with no column behind it — never sort or
  // filter on it server-side; `email`/`phone` are nullable columns that the mapper
  // coerces to '', so consumers gate on truthiness, never on `!== null`.
  contact: { id: Id | null; name: string; email: string; phone: string } | null
  // APP-STAGE-DURATIONS-1: chronological phase history, [] when the backend
  // sends none — the status strip falls back through currentStageEnteredAt
  // then the created-date line rather than ever fabricating a duration.
  stageDurations: ApplicationStageDuration[]
  // APP-MATCH-SUMMARY-1: the linked Match (Hired → match), null when this
  // application has no Match yet — the details card renders nothing for this
  // row rather than a dash when it is absent.
  match: ApplicationMatchSummary | null
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
  // APP-MATCH-SUMMARY-1: the detail contract's linked Match, null when none
  // hangs on the application. The older overall/criteria/summary fields feed
  // the SEPARATE application-fit score (a different concept from the Match
  // entity) — both live on the same raw key per the verified backend contract.
  match?: {
    overall?: number | null; criteria?: unknown[]; summary?: string
    id?: Id; reference_number?: string; status_label?: string; status_color?: string
    placement_start?: string | null; placement_end?: string | null
  } | null
  // APP-STAGE-DURATIONS-1: chronological phase history (detail only); the list
  // contract sends `current_stage_entered_at` instead (below).
  stage_durations?: Array<{
    stage_key?: string; stage_label?: string; entered_at?: string | null; left_at?: string | null; days?: number | null
  }>
  // APP-STAGE-DURATIONS-1: list contract's own "entered current stage at" timestamp.
  current_stage_entered_at?: string | null
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
  // INTERVIEW-VISIBILITY-1 (speculative): `id`/`agent`/`flow_name`/`turn`/timing
  // fields per the proposed-but-unconfirmed contract — all optional so today's
  // real payload (which omits them) still maps cleanly.
  // INTERVIEW-STOP-1: `paused_at`/`paused_by` ride along once a recruiter stops
  // the agent — also optional/nullable, same defensive treatment.
  interview?: {
    id?: Id
    category?: string
    current_status?: string | null
    statuses?: string[]
    step?: number | null
    total?: number
    completed_at?: string | null
    disqualified_reason?: string | null
    agent?: { id?: Id; name?: string } | null
    flow_name?: string | null
    turn?: string | null
    started_at?: string | null
    last_message_at?: string | null
    ended_at?: string | null
    duration_seconds?: number | null
    paused_at?: string | null
    paused_by?: { id?: Id; name?: string } | null
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
  // MOTIVATIE-ZICHTBAAR-1 (landed): the motivation letter as ApplicationDetailResource
  // sends it. Server-sanitised already, but it stays fully untrusted PUBLIC input and
  // the backend sanitizer is regex/strip_tags-based (self-described as no hardened
  // parser) — SafeHtml/DOMPurify on render is the real last line of defence (§7), never
  // a formality. Optional: only the detail contract carries this key.
  cover_letter?: string | null
  // INTERVIEW-CONSENT-PERSIST-1: the consent-tick timestamp. The DETAIL resource
  // always sends the key (ISO-8601 or null); the LIST resource never carries it,
  // hence still optional here.
  interview_consent_given_at?: string | null
  // CONTACT-PERSON-1: the contact exactly as ApplicationDetailResource::contact()
  // builds it — {id, name, email, phone}, with email/phone nullable columns on
  // customer_contacts. Optional here because only the DETAIL contract carries the
  // key; ApplicationListResource omits it, so the table/board can never show it.
  contact?: { id?: Id; name?: string; email?: string; phone?: string } | null
  [k: string]: unknown
}

export type { Loose }
