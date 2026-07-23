import { bucketOfPhase } from './applicationsShared'
import { initialsOf } from '@/lib/initials'
import type { Id, Loose } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'
import type {
  ApiApplication, Application, ApplicationDetail, ApiAppCandidate, ApiAppVacancy, ApplicationInterview,
} from '@/types/application'

/**
 * INTERVIEW-PHASE-1: raw interview block → the UI model. The list contract
 * (ApplicationListResource::interviewSummary) sends `category` directly; the
 * detail contract's interview() omits it but always sends completed_at/
 * disqualified_reason, so derive it the same way the backend does when
 * absent. Null (no session at all) stays null — that's the `interview_status=
 * none` filter bucket, never a synthetic 'none' category value.
 *
 * INTERVIEW-VISIBILITY-1 (speculative, awaiting CMBE's confirmed contract):
 * `id`/`agent`/`flowName`/`turn`/timing map defensively off the PROPOSED raw
 * field names below — every one defaults to null so today's real payload
 * (which sends none of them yet) still maps cleanly. A backend field-name
 * change is a one-line fix here, not a UI rewrite.
 *
 * INTERVIEW-STOP-1 (Danny 22-07): `paused_at`/`paused_by` map the same way —
 * nullable/defensive. Exported so Flow B (InterviewsTab's "start interview"
 * action) can map a fresh session straight out of the POST response, without
 * a full application refetch.
 */
export function mapInterview(raw?: ApiApplication['interview']): ApplicationInterview | null {
  if (!raw) return null
  const category = (raw.category
    ?? (raw.disqualified_reason ? 'disqualified' : raw.completed_at ? 'completed' : raw.paused_at ? 'paused' : 'busy')) as ApplicationInterview['category']
  return {
    category,
    currentStatus: raw.current_status ?? null,
    step: raw.step ?? null,
    total: raw.total ?? 0,
    id: raw.id ?? null,
    agent: raw.agent?.id != null ? { id: raw.agent.id, name: raw.agent.name ?? '' } : null,
    flowName: raw.flow_name ?? null,
    turn: (raw.turn ?? null) as ApplicationInterview['turn'],
    startedAt: raw.started_at ?? null,
    lastMessageAt: raw.last_message_at ?? null,
    endedAt: raw.ended_at ?? null,
    durationSeconds: raw.duration_seconds ?? null,
    pausedAt: raw.paused_at ?? null,
    pausedBy: raw.paused_by?.id != null ? { id: raw.paused_by.id, name: raw.paused_by.name ?? '' } : null,
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
    score: a.score ?? a.match_score ?? a.match?.overall ?? null,
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
    interviews: (raw.interviews ?? []).map(iv => ({
      id: iv.id, channel: iv.channel ?? 'whatsapp', status: iv.status ?? '',
      date: iv.created_at ?? '', time: iv.time ?? '', summary: iv.summary ?? '',
      transcript: (iv.transcript ?? []).map(m => ({
        author: m.author ?? '', side: m.side ?? 'in', time: m.time ?? '', text: m.text ?? '',
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
    // S15: `title` carries e.g. the detach reason's "Sollicitatie ontkoppeld"
    // heading (ApplicationDetailResource always sends it, but the ApiApplication
    // type's notes shape doesn't declare it yet — read it defensively, mirrors
    // mapVacancy's `(n as Loose).body` for the same "field exists, type is behind"
    // situation). The shared NotesTab renders it above the body when present.
    notes: (raw.notes ?? []).map(n => ({
      id: n.id, author: n.author ?? '', title: (n as Loose).title ?? '', text: n.text ?? '', time: n.created_at ?? '',
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
    // Rejection trail (reason + toelichting/note + channel/sent_at) — S9 finding:
    // this was NEVER mapped, so a rejected application always showed just the
    // "Afgewezen" badge with no reason/note, even though ApplicationDetailResource
    // sends `rejection` (reason_id/reason_label/note/channel/sent_at) once rejected.
    rejection: (raw.rejection ?? undefined) as ApplicationDetail['rejection'],
  }
}
