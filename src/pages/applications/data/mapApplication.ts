// mapApplication — the raw API → UI-model mappers for the applications feature:
// interview sessions, the list/board row shape, stage durations and the match
// summary. One boundary where the backend's field/vocabulary quirks (mixed-
// language values, list-vs-detail field gaps) get normalised into our own shape.
import { bucketOfPhase } from './applicationsShared'
import { initialsOf } from '@/lib/initials'
import type { Id } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'
import type {
  ApiApplication, Application, ApplicationDetail, ApiAppCandidate, ApiAppVacancy, ApplicationInterview,
  ApplicationStageDuration, ApplicationMatchSummary,
} from '@/types/application'

/**
 * INTERVIEW-PHASE-1: raw interview block → the UI model. The list contract
 * (ApplicationListResource::interviewSummary) sends `category` directly; the
 * detail contract's interview() omits it but always sends completed_at/
 * disqualified_reason, so derive it the same way the backend does when
 * absent. Null (no session at all) stays null — that's the `interview_status=
 * none` filter bucket, never a synthetic 'none' category value.
 *
 * INTERVIEW-VISIBILITY-1 is LIVE (measured 01-08 in InterviewSessionResource).
 * Which endpoint carries what is NOT uniform, so read the split before using a
 * field on a new surface:
 *  · BOTH list and detail send `id`, `category`, `current_status`, `step`,
 *    `total`, `flow_name`, `completed_at`, `last_sent_at`;
 *  · DETAIL ONLY (InterviewSessionResource::block) adds `agent`, `turn`,
 *    `started_at`, `duration_seconds`, `disqualified_reason`, `statuses`,
 *    `collected` and the `paused_at`/`paused_by`/`paused_by_name` trio.
 * So a table/board/KPI row may render category/step/flow name, but NEVER agent,
 * turn, duration or pause state — those are null there and would read as "no
 * agent"/"unknown" on every row.
 *
 * INTERVIEW-STOP-1 (Danny 22-07): `paused_at`/`paused_by` map the same way —
 * nullable/defensive. Exported so Flow B (InterviewsTab's "start interview"
 * action) can map a fresh session straight out of the POST response, without
 * a full application refetch.
 */
// The backend derives `turn` with a MIXED-LANGUAGE vocabulary — 'agent' and 'recruiter'
// in English next to 'kandidaat' and 'afgerond' in Dutch (measured 30-07 in
// ApplicationDetailResource: the derivation around line 261). Our chip looks up an i18n
// key and a colour by that value, so the two Dutch ones produced a raw key and no colour.
// Normalised here, at the single boundary where raw becomes ours; a stable English
// vocabulary at the source is the better fix and is filed with the backend lane.
const TURN_ALIASES: Record<string, NonNullable<ApplicationInterview['turn']>> = {
  kandidaat: 'candidate',
  afgerond: 'completed',
}
const mapTurn = (raw: unknown): ApplicationInterview['turn'] => {
  const v = typeof raw === 'string' ? raw : ''
  if (!v) return null
  return TURN_ALIASES[v] ?? (v as NonNullable<ApplicationInterview['turn']>)
}

// Accepts both the flat (uuid + separate name) and the nested shape.
const mapPausedBy = (raw: NonNullable<ApiApplication['interview']>): ApplicationInterview['pausedBy'] => {
  const by = raw.paused_by
  if (by && typeof by === 'object') return by.id != null ? { id: by.id, name: by.name ?? '' } : null
  if (typeof by === 'string' && by) return { id: by, name: raw.paused_by_name ?? '' }
  return null
}

export function mapInterview(raw?: ApiApplication['interview']): ApplicationInterview | null {
  if (!raw) return null
  const category = (raw.category
    ?? (raw.disqualified_reason ? 'disqualified' : raw.completed_at ? 'completed' : raw.paused_at ? 'paused' : 'busy')) as ApplicationInterview['category']
  return {
    category,
    currentStatus: raw.current_status ?? null,
    step: raw.step ?? null,
    total: raw.total ?? 0,
    // INTERVIEW-STEP-COUNT-1: tolerant fallback — an older cached payload without
    // these keys reads as "unknown position" rather than a fabricated zero.
    questionStepIndex: raw.question_step_index ?? null,
    questionStepsTotal: raw.question_steps_total ?? 0,
    // INTERVIEW-SIBLING-1: default to 'application' when the server omits the
    // field (older cached shapes) — the safe, non-alarming assumption.
    sessionScope: raw.interview_session_scope ?? 'application',
    id: raw.id ?? null,
    agent: raw.agent?.id != null ? { id: raw.agent.id, name: raw.agent.name ?? '' } : null,
    flowName: raw.flow_name ?? null,
    // Detail-only, like agent/turn (InterviewSessionResource.php:81) — drives
    // the settings deep-link on the flow name.
    flowId: raw.flow_id ?? null,
    turn: mapTurn(raw.turn),
    startedAt: raw.started_at ?? null,
    // The UI names stay `lastMessageAt`/`endedAt`, but the COLUMNS behind them are
    // `last_sent_at` and `completed_at`. There is no `last_message_at`/`ended_at`
    // column and the backend never sent either, so mapping those spellings kept both
    // fields permanently null and left the duration fallback dead code (measured 01-08).
    lastMessageAt: raw.last_sent_at ?? null,
    endedAt: raw.completed_at ?? null,
    // Wall-clock seconds from session creation to completion (or to now while live) —
    // detail-only. NOT talk time: nights and weekends are inside it, so every label
    // built on it must say "elapsed since start", never "conversation duration".
    durationSeconds: raw.duration_seconds ?? null,
    pausedAt: raw.paused_at ?? null,
    // `paused_by` is a BARE uuid with the display name alongside it in `paused_by_name`
    // (measured 30-07) — reading it as an object made "overgenomen door …" permanently
    // empty. The object shape is still tolerated in case the resource ever nests it.
    pausedBy: mapPausedBy(raw),
  }
}

/**
 * mapApplication — raw API application → the flat shape the table/board/drawer
 * render. Snake_case-tolerant and defensive about the exact field names (the
 * /applications endpoint is not built yet — see docs/worklist.md), so it accepts
 * several spellings and never throws on a missing field. `funnelTypes` (the tenant
 * funnel lookup, from useLookups()) drives the flag-based bucket fallback — only
 * used when the API doesn't already send an explicit `bucket` (A1).
 */
export function mapApplication(a: ApiApplication = {}, funnelTypes: LookupItem[] = []): Application {
  const cand: ApiAppCandidate = a.candidate ?? {}
  const joined = [cand.first_name, cand.last_name].filter(Boolean).join(' ')
  const candidateName = a.candidate_name ?? cand.name ?? (joined || '—')

  const vacancy: ApiAppVacancy = a.vacancy ?? {}
  const owner: { id?: Id; name?: string; avatar_color?: string | null } = a.owner ?? {}

  // Phase carries its own label + colour from the backend lookup; the bucket is
  // derived from the phase key (falling back to an explicit `bucket` field).
  const phaseKey = a.phase_key ?? a.stage ?? a.phase ?? 'applied'

  return {
    id: a.id,
    candidateId: a.candidate_id ?? cand.id ?? null,
    candidateName,
    candidateInitials: candidateName !== '—' ? initialsOf(candidateName) : '?',
    vacancyId: a.vacancy_id ?? vacancy.id ?? null,
    vacancyTitle: a.vacancy_title ?? vacancy.title ?? '—',
    client: a.client_name ?? a.client?.name ?? a.customer?.name ?? vacancy.client_name ?? '—',
    // S12/13: the customer id (ApplicationListResource sends the vacancy's client_id).
    customerId: a.customer_id ?? null,
    // S5: the application's own display number (e.g. "S-00123").
    referenceNumber: a.reference_number ?? '',
    // W31 (verified live 07-08 against ApplicationDetailResource::matchLink()): the
    // nested `match.overall` fallback is dead — that array never carried an `overall`
    // key (only id/reference_number/status_label/status_color/match_*).
    score: a.score ?? a.match_score ?? null,
    task: a.task ?? a.ai_task ?? a.ai?.task ?? '',
    phaseKey,
    bucket: a.bucket ?? bucketOfPhase(phaseKey, funnelTypes),
    // INTERVIEW-PHASE-1: the live interview session's category + step progress.
    interview: mapInterview(a.interview),
    source: a.source ?? a.source_name ?? '',
    owner: {
      id: owner.id ?? a.owner_id ?? null,
      name: owner.name ?? a.owner_name ?? '',
      initials: initialsOf(owner.name ?? a.owner_name ?? ''),
      color: owner.avatar_color ?? null,
    },
    candidateStatusLabel: a.candidate_status_label ?? cand.status_label ?? '',
    candidateStatusColor: a.candidate_status_color ?? cand.status_color ?? 'var(--text-muted)',
    // Slugs when present (drives the shared chip's model-v2 rules); empty otherwise.
    candidateStatus: (a.candidate_status ?? cand.status ?? '') as string,
    candidatePhase: (a.candidate_phase ?? cand.phase ?? '') as string,
    created: a.created_at ?? a.applied_at ?? '',
    isNew: Boolean(a.is_new ?? false),
    // APP-DELETED-AT-1: the backend now sends BOTH fields for real (previously
    // neither ApplicationListResource nor ApplicationDetailResource sent them at
    // all, so `archived` had to be inferred/forced by the caller — no longer
    // needed). Detached rows arrive only with `?include_archived=1`.
    archived: Boolean(a.archived ?? Boolean(a.deleted_at)),
    deletedAt: a.deleted_at ?? null,
    // APP-STAGE-DURATIONS-1: the list contract's own "entered current stage" timestamp.
    currentStageEnteredAt: a.current_stage_entered_at ?? null,
    // V-appdetail-1: requires_appointment phase with no planned appointment.
    missingAppointment: Boolean(a.missing_appointment),
    // D6-KAART-2: same predicate as the too_long_in_stage=1 filter / attention count.
    tooLongInStage: Boolean(a.too_long_in_stage),
    // PLACED-1: batched EXISTS on `matches` — tolerant default false when the
    // field is absent (older cached payloads, pre-9ba44e54 fixtures).
    hasMatch: Boolean(a.has_match),
  }
}

/**
 * APP-STAGE-DURATIONS-1: raw stage-durations array → the UI model. Defensive
 * per-entry reads so a missing field never crashes the strip; `days` stays
 * null (never fabricated) when the backend omits it.
 */
export function mapStageDurations(raw?: ApiApplication['stage_durations']): ApplicationStageDuration[] {
  return (raw ?? []).map(s => ({
    stageKey: s.stage_key ?? '',
    stageLabel: s.stage_label ?? '',
    enteredAt: s.entered_at ?? null,
    leftAt: s.left_at ?? null,
    days: s.days ?? null,
  }))
}

/**
 * APP-MATCH-SUMMARY-1: raw `match` block → the linked-Match summary, null when
 * the application has no Match (verified live: absent until Hired → Match).
 * Only maps when the backend actually sends an id — the older overall/summary
 * shape (no id) is NOT a Match and must not render as one.
 */
export function mapMatchSummary(raw?: ApiApplication['match']): ApplicationMatchSummary | null {
  if (!raw || raw.id == null) return null
  return {
    id: raw.id,
    referenceNumber: raw.reference_number ?? '',
    statusLabel: raw.status_label ?? '',
    statusColor: raw.status_color ?? 'var(--text-muted)',
    // PLACEMENT-REMOVED-1 (verified live 2026-08-07, CMBE 5961c673): the deprecated
    // `placement_*` alias (MATCH-VOCABULAIRE-1) is gone from ApplicationDetailResource
    // ::matchLink() now — `match_start`/`match_end` is the only pair the backend ever
    // sends. The fallback read is pruned; a stray `placement_*` on an old cached
    // payload is simply ignored, never surfaced as a real date.
    matchStart: raw.match_start ?? null,
    matchEnd: raw.match_end ?? null,
  }
}

/**
 * mapApplicationDetail — raw API detail (GET /applications/{id}) → the enriched
 * shape the drawer tabs render. Builds on mapApplication and normalises the
 * nested objects (candidate, vacancy, interviews, appointments, timeline, match).
 * Defensive: every nested list defaults to [] so a tab never crashes.
 */
export function mapApplicationDetail(raw: ApiApplication = {}, funnelTypes: LookupItem[] = []): ApplicationDetail {
  const base = mapApplication(raw, funnelTypes)
  const cand: ApiAppCandidate = raw.candidate ?? {}
  const vac: ApiAppVacancy = raw.vacancy ?? {}

  return {
    ...base,
    candidate: {
      name: base.candidateName, initials: base.candidateInitials,
      function: cand.function_title ?? cand.title ?? '',
      statusLabel: base.candidateStatusLabel, statusColor: base.candidateStatusColor,
      gender: cand.gender ?? '', nationality: cand.nationality ?? '',
      dob: cand.date_of_birth ?? cand.dob ?? '',
      email: cand.email ?? '', phone: cand.phone ?? '',
      address: cand.address ?? cand.city ?? '', summary: cand.summary ?? '',
    },
    vacancy: {
      id: vac.id ?? base.vacancyId, title: vac.title ?? base.vacancyTitle, client: base.client,
      vacancyId: vac.code ?? vac.reference ?? '', status: vac.status_label ?? vac.status ?? '',
      employmentType: vac.employment_type ?? '',
      // Locatie (S6): ApplicationDetailResource sends the vacancy's work-site `city`
      // (from location_city), not a `location` string — fall back to it so the
      // Sollicitatie tab's Locatie field isn't always blank (measured: no
      // customer_location_id/afdeling exists on a vacancy yet, see ApplicationTab.tsx).
      location: vac.location ?? (vac.city as string | undefined) ?? '',
      salary: vac.salary ?? '', hours: vac.hours ?? '', experience: vac.experience ?? '',
      seniority: vac.seniority ?? '', education: vac.education ?? '',
      branch: vac.branch ?? vac.industry ?? '', category: vac.category ?? '',
      skills: vac.skills ?? [], tags: vac.tags ?? [],
    },
    // W7 (measured 07-08 in ApplicationDetailResource::interviews): the previous mapping
    // read `channel`/`created_at`/`time`/`summary` and transcript `author`/`side`/`time`/
    // `text` — none of those keys exist on the resource, so this tab rendered blank/garbage
    // fields. The real shape is `status`/`started_at`/`finished_at` and, per transcript
    // entry, `direction`/`body`/`sent_at` only (no author identity — data minimisation §9).
    interviews: (raw.interviews ?? []).map(iv => ({
      id: iv.id, status: iv.status ?? '',
      startedAt: iv.started_at ?? null, finishedAt: iv.finished_at ?? null,
      transcript: (iv.transcript ?? []).map(m => ({
        direction: m.direction ?? '', body: m.body ?? '', sentAt: m.sent_at ?? null,
      })),
    })),
    // `when` stays the RAW scheduled_at (no pre-formatting) — the card formats it with the
    // correct UTC wall-time handling, and the shared PlanIntakeModal needs the raw ISO to edit.
    appointments: (raw.appointments ?? []).map(ap => ({
      id: ap.id, type: ap.type ?? '', title: ap.title ?? '',
      when: ap.scheduled_at ?? ap.when ?? '', with: ap.owner?.name ?? ap.with ?? '',
      status: ap.status ?? 'planned',
      durationMin: ap.duration_min ?? null, modality: ap.modality ?? '',
      ownerId: ap.owner?.id ?? null, locationName: ap.location_name ?? '',
    })),
    timeline: (raw.timeline ?? []).map(ev => ({
      id: ev.id, author: ev.author ?? '', initials: ev.author_initials ?? '',
      description: ev.description ?? '', ai: Boolean(ev.ai), time: ev.created_at ?? ev.time ?? '',
    })),
    // S15: `title` carries e.g. the detach reason's "Sollicitatie ontkoppeld" heading.
    // The shared NotesTab renders it above the body when present.
    // W10 (verified live 07-08): `type`/`language` now map through — they used to be
    // dropped here, so a re-fetched note lost its type chip and spellcheck language
    // even though ApplicationDetailResource::applicationNotes() always sends both.
    // NOTE-AUTHOR-SHAPE-2 (verified live 2026-08-07, CMBE 5961c673): `author_id` now
    // maps through too — a fetched note used to always drop this key, which kept the
    // shared NotesTab's canManageNote() permissive by omission (`undefined` = "not
    // migrated") for every application note regardless of who actually wrote it.
    notes: (raw.notes ?? []).map(n => ({
      id: n.id, author: n.author ?? '', authorId: n.author_id ?? null, type: n.type ?? '', title: n.title ?? '',
      text: n.text ?? '', language: n.language ?? '', time: n.created_at ?? '',
    })),
    // Match SCORE = the fit on the application (flat fields; "match" the noun is a
    // separate entity). `score` (overall) comes from mapApplication (match_score).
    matchCriteria: raw.match_criteria ?? raw.match?.criteria ?? [],
    matchSummary: raw.match_summary ?? raw.match?.summary ?? '',
    // AI vs manual override (the AI's own score is kept when overridden).
    matchSource: raw.match_score_source ?? 'ai',
    aiScore: raw.ai_match_score ?? null,
    // Tenant custom-field values (§3B "Eigen velden").
    customFields: raw.custom_fields ?? {},
    // MOTIVATIE-ZICHTBAAR-1: the careersite motivation letter, null-safe until
    // CMBE emits `cover_letter` on the detail resource (honest-gated in the tab).
    coverLetter: raw.cover_letter ?? null,
    // INTERVIEW-CONSENT-PERSIST-1: null-safe read of the consent timestamp. Null is
    // the NORMAL case — only the public careersite apply ever writes it — so it means
    // "no consent recorded", not "consent refused" (see types/application.ts).
    interviewConsentGivenAt: raw.interview_consent_given_at ?? null,
    // Rejection trail (reason + toelichting/note + channel/sent_at) — S9 finding:
    // this was NEVER mapped, so a rejected application always showed just the
    // "Afgewezen" badge with no reason/note, even though ApplicationDetailResource
    // sends `rejection` (reason_id/reason_label/note/channel/sent_at) once rejected.
    rejection: (raw.rejection ?? undefined) as ApplicationDetail['rejection'],
    // CONTACT-PERSON-1: the vacancy/customer contact person — null when the
    // backend sends none (defensive per-field reads, never crash on a partial object).
    contact: raw.contact
      ? { id: raw.contact.id ?? null, name: raw.contact.name ?? '', email: raw.contact.email ?? '', phone: raw.contact.phone ?? '' }
      : null,
    // APP-STAGE-DURATIONS-1: chronological phase history, [] when absent.
    stageDurations: mapStageDurations(raw.stage_durations),
    // APP-MATCH-SUMMARY-1: the linked Match, null when none hangs on this application.
    match: mapMatchSummary(raw.match),
  }
}
