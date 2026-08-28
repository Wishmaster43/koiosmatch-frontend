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
 * INTERVIEW-VISIBILITY-1 is LIVE (measured 01-08). Fields stay nullable because
 * they are NOT uniformly available: `id`/`flowName`/`endedAt`/`lastMessageAt`
 * come from list AND detail, while `agent`/`turn`/`startedAt`/`durationSeconds`/
 * `pausedAt`/`pausedBy` are DETAIL-ONLY. Anything rendering a list row must
 * therefore stick to the first group (§3 no fake affordances).
 *
 * INTERVIEW-STOP-1 (Danny 22-07): `paused` is the category a session moves to
 * once a recruiter stops the agent (`POST /applications/{id}/stop-interview`);
 * `pausedAt`/`pausedBy` record when/who.
 */
export interface ApplicationInterview {
  category: 'busy' | 'completed' | 'disqualified' | 'paused'
  currentStatus: string | null
  step: number | null
  total: number
  // INTERVIEW-STEP-COUNT-1 (InterviewSessionResource.php:132-140, landed 5f030fb3):
  // the QUESTION-only step readout, excluding the flow's system boundary statuses
  // (INTRO_SENT/COMPLETED/DISQUALIFIED). Use these for "stap X van N" instead of
  // step/total above, which count every status including those boundaries.
  questionStepIndex?: number | null
  questionStepsTotal?: number
  // INTERVIEW-SIBLING-1 (InterviewSessionResource.php:154): 'application' = this
  // session belongs to THIS application; 'candidate' = borrowed from a sibling
  // application of the same candidate on the same flow — render an honest note
  // instead of implying this application's own interview progress.
  sessionScope?: 'application' | 'candidate'
  // The interview session's own id. Present on both contracts, but the stop/resume
  // routes target the APPLICATION id, so no action gates on it.
  id: Id | null
  // The AI agent running the session — resolved deterministically server-side
  // (InterviewSession::resolveAgent orders by created_at, then id), so the name
  // is authoritative and may be shown plainly. Detail-only.
  agent: { id: Id; name: string } | null
  // The interview flow's own name (interview_flows.name), via the relation.
  flowName: string | null
  // The flow's own id (interview_sessions.interview_flow_id) — detail-only, like
  // agent/turn (InterviewSessionResource.php:81); drives the settings deep-link.
  flowId: Id | null
  // 'completed' is the backend's 'afgerond': nobody is on turn any more because the
  // interview is finished. Normalised in mapInterview — see the alias table there.
  turn: 'agent' | 'candidate' | 'completed' | 'pending' | 'recruiter' | null
  startedAt: string | null
  // Backed by `last_sent_at` — the last moment WE sent, not the last message overall.
  lastMessageAt: string | null
  // Backed by `completed_at` — there is no `ended_at` column.
  endedAt: string | null
  // ELAPSED wall-clock seconds since the session started (nights and weekends
  // included), NOT time spent conversing. Detail-only; label it accordingly.
  durationSeconds: number | null
  pausedAt: string | null
  // Flattened from the bare `paused_by` uuid + its sibling `paused_by_name`.
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
  // Who set the leading score: 'ai' | 'manual' (undefined on older list payloads).
  scoreSource?: string
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
  // V-appdetail-1 (§3B): true when this application sits at a requires_appointment
  // funnel phase but carries no planned appointment — the same inconsistency flag
  // the candidate resource already exposes (missing_appointment), read here at the
  // application's own level so a row can flag it without a second candidate fetch.
  missingAppointment: boolean
  // D6-KAART-2: same predicate as the stats.attention.too_long_in_stage count
  // (df9450dc) — flags a row whose current stage was entered before the tenant
  // stale-stage threshold, so the table can show a subtle per-row indicator.
  tooLongInStage: boolean
  // PLACED-1: a real linked Match exists on this application (batched EXISTS,
  // never a per-row query) — drives the row/card placed badge and the "placed"
  // bucket-donut segment client-side. Tolerant default false when absent.
  hasMatch: boolean
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
  // W7 (measured 07-08 in ApplicationDetailResource::interviews — APP-INTERVIEW-HISTORY-1):
  // one row per REAL InterviewSession, never the invented `channel`/`date`/`time`/`summary`
  // shape a prior version guessed at (those keys do not exist on the resource). `status` is
  // the session outcome (completed/failed/running); the transcript carries only
  // direction/body/sent_at — no author identity, by data-minimisation design (§9).
  interviews: Array<{
    id: Id | undefined; status: 'completed' | 'failed' | 'running' | ''
    startedAt: string | null; finishedAt: string | null
    transcript: Array<{ direction: 'inbound' | 'outbound' | ''; body: string; sentAt: string | null }>
  }>
  appointments: Array<{
    id: Id | undefined; type: string; title: string; when: string; with: string; status: string
    // Kept RAW (no pre-formatting) so the shared PlanIntakeModal can prefill an edit.
    durationMin: number | null; modality: string; ownerId: Id | null; locationName: string
  }>
  timeline: Array<{ id: Id | undefined; author: string; initials: string; description: string; ai: boolean; time: string }>
  // W10 (07-08): `type`/`language` used to be dropped on the floor here even though
  // ApplicationDetailResource::applicationNotes() sends both (type = note_types slug,
  // language = the note's own spellcheck/output language) — the composer's chosen
  // type/language silently vanished the moment a note round-tripped through a fetch.
  // NOTE-AUTHOR-SHAPE-2 (verified live 2026-08-07, CMBE 5961c673): `authorId` is the
  // note's OWNER user id (resolved from `author_id`) — the shared NotesTab's
  // canManageNote() rights gate reads this to tell "note is mine" from "note is a
  // colleague's" (a null/omitted key stays permissive; a real id engages the gate).
  notes: Array<{ id: Id | undefined; author: string; authorId: Id | null; type: string; title: string; text: string; language: string; time: string; hasPreviousVersion?: boolean }>
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
  // INTERVIEW-FLOW-BINDING-1: this application's own flow OVERRIDE (the engine
  // resolves module → application → vacancy → agent) — null means "use the
  // vacancy's default" (itself falling back to the agent's own flow).
  interviewFlowId: Id | null
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
    // MATCH-VOCABULAIRE-1 (verified live 07-08): the resource now sends BOTH pairs —
    // `match_*` is the current field name, `placement_*` is the deprecated alias kept
    // for one release (ApplicationDetailResource::matchLink() comment: "drop the old
    // pair once CMFE reports it unused"). The mapper below now reads `match_*` first;
    // `placement_*` stays typed only as a fallback until the backend confirms removal.
    match_start?: string | null; match_end?: string | null
    placement_start?: string | null; placement_end?: string | null
  } | null
  // APP-STAGE-DURATIONS-1: chronological phase history (detail only); the list
  // contract sends `current_stage_entered_at` instead (below).
  stage_durations?: Array<{
    stage_key?: string; stage_label?: string; entered_at?: string | null; left_at?: string | null; days?: number | null
  }>
  // APP-STAGE-DURATIONS-1: list contract's own "entered current stage at" timestamp.
  current_stage_entered_at?: string | null
  // V-appdetail-1: mirrors CandidateResource's own missing_appointment flag.
  missing_appointment?: boolean
  // PLACED-1 (2026-08-14, backend commit 9ba44e54): batched EXISTS on `matches` —
  // present on list/board/detail rows and the store/update echo alike.
  has_match?: boolean
  // INTERVIEW-FLOW-BINDING-1: this application's own flow override (detail contract).
  interview_flow_id?: Id | null
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
  // INTERVIEW-VISIBILITY-1 (LIVE, measured 01-08): every key below is a REAL
  // interview_sessions column or relation. Both spellings the FE once guessed at —
  // `ended_at` and `last_message_at` — are gone: those columns do not exist, the
  // end of an interview IS `completed_at` and the last send IS `last_sent_at`.
  // Optional per key because the LIST resource sends a subset (no agent/turn/
  // started_at/duration_seconds/paused_*).
  // INTERVIEW-STOP-1: `paused_by` is a BARE uuid; the display name travels
  // separately in `paused_by_name` (the nested object is tolerated, never sent).
  interview?: {
    id?: Id
    category?: string
    current_status?: string | null
    statuses?: string[]
    step?: number | null
    total?: number
    // INTERVIEW-STEP-COUNT-1 / INTERVIEW-SIBLING-1 (InterviewSessionResource.php,
    // commit 5f030fb3) — optional because older cached shapes may lack them.
    question_step_index?: number | null
    question_steps_total?: number
    interview_session_scope?: 'application' | 'candidate'
    completed_at?: string | null
    last_sent_at?: string | null
    disqualified_reason?: string | null
    agent?: { id?: Id; name?: string } | null
    // The flow's own id (InterviewSessionResource.php:81) — detail-only.
    flow_id?: Id | null
    flow_name?: string | null
    turn?: string | null
    started_at?: string | null
    duration_seconds?: number | null
    paused_at?: string | null
    paused_by?: Id | { id?: Id; name?: string } | null
    paused_by_name?: string | null
  } | null
  // W7 (measured 07-08 in ApplicationDetailResource::interviews): the real per-session
  // history row — `status` is one of completed/failed/running (session.completed_at /
  // paused_at derived), `started_at`/`finished_at` are the real session columns (no
  // `created_at`/`time`/`summary` on this resource), and each transcript entry is a
  // conversation-message SLICE: direction/body/sent_at only.
  interviews?: Array<{
    id?: Id; status?: 'completed' | 'failed' | 'running'
    started_at?: string | null; finished_at?: string | null
    transcript?: Array<{ direction?: 'inbound' | 'outbound'; body?: string | null; sent_at?: string | null }>
  }>
  appointments?: Array<{
    id?: Id; type?: string; title?: string; scheduled_at?: string; when?: string
    duration_min?: number | null; modality?: string; location_name?: string
    owner?: { id?: Id; name?: string }; with?: string; status?: string
  }>
  timeline?: Array<{ id?: Id; author?: string; author_initials?: string; description?: string; ai?: unknown; created_at?: string; time?: string }>
  // W10 (verified live 07-08 against ApplicationDetailResource::applicationNotes()):
  // the resource sends `type`/`title`/`language` alongside author/text/created_at.
  // NOTE-AUTHOR-SHAPE-2 (verified live 2026-08-07, CMBE 5961c673): `author_id` now
  // ships on every note too, and `author` resolves to a real name — the controller's
  // `ownerNames` map (previously referenced but never filled) is populated from a
  // single central-connection lookup before the resource serializes.
  notes?: Array<{ id?: Id; author?: string; author_id?: Id | null; type?: string; title?: string | null; text?: string; language?: string | null; created_at?: string; has_previous_version?: boolean }>
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
