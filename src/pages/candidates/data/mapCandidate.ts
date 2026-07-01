/**
 * mapCandidate — the SINGLE place that turns a raw API candidate record into the
 * shape the UI works with. Both the list/drawer and the CV generator consume this.
 *
 * The backend is snake_case and uses the 3-layer model (candidate_types[] · funnel_type
 * · status, all English slugs — labels/colours come from the lookups API). Detail
 * responses (GET /candidates/{id}) carry the relations + stats + timeline; the list
 * is intentionally light. The `?? ` fallbacks also keep the dummy data working.
 */
import { initialsOf } from '@/lib/initials'
import type { ApiCandidate, Candidate, CandidatePool, CandidateBranch, CandidateMatch, Loose } from '@/types/candidate'

// Bytes → human size ("44856" → "44 KB"). Backend sends documents.size in bytes.
const fmtSize = (b: unknown): string => {
  if (b == null || b === '') return ''
  const n = Number(b)
  if (Number.isNaN(n)) return String(b)
  if (n < 1024)        return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// Newest-first sort for dated lists. Unparseable dates (dummy "period" strings)
// fall back to keeping order (stable sort); ongoing items sort to the top.
const dateVal = (v: unknown): number => {
  if (v == null || v === '') return 0
  const t = new Date(v as string | number | Date).getTime()
  return Number.isNaN(t) ? 0 : t
}
const byNewest = <T>(list: T[], getKey: (x: T) => number): T[] =>
  [...list].sort((a, b) => getKey(b) - getKey(a))

export function mapCandidate(c: ApiCandidate): Candidate {
  const name = c.name || c.full_name
    || [c.firstname, c.lastname].filter(Boolean).join(' ')
    || [c.first_name, c.last_name].filter(Boolean).join(' ') || '?'

  const ownerName = c.owner?.name ?? c.recruiter?.name ?? c.owner_name ?? ''

  // Contract form is MULTI-value (English slugs: on_call, freelance, payroll, …).
  // Accept an array from the API, or fall back to a single legacy field as array.
  const rawTypes = c.candidate_types ?? c.candidate_type ?? c.employment_type ?? c.type ?? []
  const candidateTypes: string[] = (Array.isArray(rawTypes) ? rawTypes : [rawTypes])
    .map((t) => (t && typeof t === 'object' ? ((t as Loose).value ?? (t as Loose).id ?? (t as Loose).name) : t))
    .filter(Boolean)
    .map((v) => String(v))

  // v2 axes shim (decision 2026-06-29): split the legacy single `status` (lifecycle)
  // into phase (Lead/Kandidaat) + deployability ("status"), until the backend (C-10)
  // delivers them directly. Explicit c.phase/c.deployability always win. NEVER invent
  // a value — only faithful mappings; anything unknown stays EMPTY (no mock data).
  const rawStatus = String(c.status ?? '')
  const LEGACY_PHASE: Record<string, string> = { lead: 'lead', candidate: 'candidate', matched: 'candidate', inactive: 'candidate', unplaceable: 'candidate' }
  const LEGACY_DEPLOY: Record<string, string> = { matched: 'placed', inactive: 'unavailable', unplaceable: 'unavailable' }
  const isLegacy = rawStatus in LEGACY_PHASE
  const phase = String(c.phase ?? (isLegacy ? LEGACY_PHASE[rawStatus] : ''))
  // Real deployability only: explicit field, faithful legacy map, a new (non-legacy)
  // status slug, or the availability axis — else empty. Lead/Candidate get NO guess.
  const deployability = String(c.deployability ?? LEGACY_DEPLOY[rawStatus] ?? (isLegacy ? (c.availability ?? '') : (rawStatus || c.availability || '')))

  return {
    id:              c.id ?? '',
    name,
    initials:        initialsOf(name),
    title:           c.function_title ?? c.title ?? '',
    // Contract form (multi-value slugs); label/colour via the lookups.
    candidateTypes,
    // Funnel stage — flat fields from the API: key + NL label + colour (null = not in procedure).
    stage:           c.funnel_type ?? c.stage ?? c.lifecycle ?? '',
    stageLabel:      c.funnel_label ?? null,
    stageColor:      c.funnel_color ?? null,
    stageVacancyId:  c.funnel_vacancy_id ?? c.stage_vacancy_id ?? c.vacancy_id ?? '',
    // Phase = lifecycle (Lead/Kandidaat); status = deployability (v2 model). Both
    // come from the shim above so legacy lifecycle data still renders correctly.
    phase,
    status:          deployability,
    // Status audit (Golf ②): reason + "available again" date + when/who it changed;
    // blacklist reason + by/at. Shown in the drawer once the backend returns them.
    statusReason:     c.status_reason ?? null,
    statusReturnDate: c.status_return_date ?? null,
    statusChangedAt:  c.status_changed_at ?? c.status_effective_from ?? null,
    blacklistReason:  c.blacklist_reason ?? null,
    // Availability — legacy separate axis (folded into deployability in v2); kept for back-compat.
    availability:    c.availability ?? null,
    owner:           ownerName,
    ownerId:         c.owner?.id ?? c.owner_id ?? null,
    ownerColor:      c.owner?.avatar_color ?? c.recruiter?.avatar_color ?? c.owner_avatar_color ?? null,
    ownerInitials:   initialsOf(ownerName),
    city:            c.city ?? '',
    province:        c.province ?? '',
    lastContactAt:   c.last_contact_at ?? c.last_contacted_at ?? null,
    // Backend sends these flat (last_contact_at / last_contact_type); keep the
    // nested last_contact.{date,type} as a fallback for older payloads.
    lastContactDate: c.last_contact?.date ?? c.last_contact_at ?? c.last_contacted_at ?? null,
    lastContactType: c.last_contact_type ?? c.last_contact?.type ?? null,
    client:          c.client?.name ?? c.customer?.name ?? c.client_name ?? '',
    created:         c.created_at ?? c.created ?? '',
    email:           c.email ?? '-',
    phone:           c.phone ?? c.mobile ?? '-',
    // Detail address parts (list only sends `address`/`city`).
    street:          c.street ?? '',
    houseNumber:     c.house_number ?? '',
    houseNumberSuffix: c.house_number_suffix ?? c.house_number_addition ?? '',
    postalCode:      c.postal_code ?? '',
    address:         [c.street, c.city].filter(Boolean).join(', ') || c.address || c.city || '-',
    gender:          c.gender ?? c.sex ?? '-',
    nationality:     c.nationality ?? '-',
    dob:             c.date_of_birth ?? c.dob ?? c.birthdate ?? '-',
    placeOfBirth:    c.place_of_birth ?? c.placeOfBirth ?? '',
    linkedin:        c.linkedin ?? '',
    photoUrl:        c.photo_url ?? c.photoUrl ?? null,
    summary:         c.summary ?? c.bio ?? '',
    tags:            c.tags ?? [],
    // Archived = soft-deleted (deleted_at set). Off by default in the list; the
    // "Gearchiveerd" view opts in via ?include_archived=1.
    archived:        !!(c.deleted_at ?? c.archived),
    // Inconsistency flag (§3B): requires_appointment stage with no planned appointment.
    missingAppointment: !!c.missing_appointment,
    // Branches (C-4, M2M) — each { id, name }; accepts bare names too (→ { name }).
    branches:        (c.branches ?? []).map((b): CandidateBranch => (typeof b === 'object' ? b : { name: b })),
    // Talent pools the candidate belongs to. Each: { id, name, color, source? }.
    // Accepts bare slugs/strings too (normalised to { name }).
    pools:           (c.pools ?? []).map((p): CandidatePool => (typeof p === 'object' ? p : { name: p })),
    // Koios AI advice, precomputed server-side (background job).
    koiosAdvice:     c.koios_advice ?? c.koiosAdvice ?? null,

    // ── Relations (detail only) — normalise snake_case → camelCase, newest first ──
    // Normalise to the UI camelCase shape (start/end/current/desc) alongside the raw
    // snake_case, so read-mode AND the edit form (AddForm keys) share one shape.
    experiences:     byNewest((c.experiences ?? c.work_experience ?? []).map(e => ({
      ...e,
      title:   e.title   ?? e.function_title,
      company: e.company ?? e.employer,
      start:   e.start   ?? e.start_date,
      end:     e.end     ?? e.end_date,
      current: e.current ?? false,
      desc:    e.desc    ?? e.description,
    })), e => e.current ? Infinity : Math.max(dateVal(e.end), dateVal(e.start))),
    educations:      byNewest((c.educations ?? c.education ?? []).map(e => ({
      ...e,
      title:      e.title      ?? e.education,
      school:     e.school     ?? e.institution,
      start:      e.start      ?? e.start_date,
      end:        e.end        ?? e.end_date,
      inProgress: e.inProgress ?? e.in_progress ?? false,
      issued:     e.issued     ?? e.issue_date,
      desc:       e.desc       ?? e.description,
    })), e => e.inProgress ? Infinity : Math.max(dateVal(e.end), dateVal(e.issued), dateVal(e.start))),
    languages:       (c.languages ?? []).map(l => ({
      ...l,
      spoken:  l.spoken  ?? l.spoken_level,
      written: l.written ?? l.written_level,
    })),
    certifications:  byNewest(
      (c.certifications ?? []).map(x => ({
        ...x,
        name:    x.name    ?? x.title,
        org:     x.org     ?? x.organisation,
        issued:  x.issued  ?? x.issue_date,
        expires: x.expires ?? x.expiry_date,
        license: x.license ?? x.license_number,
        desc:    x.desc    ?? x.description,
      })),
      x => Math.max(dateVal(x.issued), dateVal(x.expires)),
    ),
    skills:          c.skills ?? [],
    documents:       (c.documents ?? []).map(d => ({
      ...d,
      name: d.name ?? d.file_name,
      size: typeof d.size === 'string' && /\D/.test(d.size) ? d.size : fmtSize(d.size),
      url:  d.url,
      type: d.type ?? null,
    })),
    applications:    c.applications ?? [],
    // Matches = own entity (read-only on the candidate). The contract lives in
    // HelloFlex — we only surface its status + the link GUID. No placements/contract fields.
    matches:         (c.matches ?? []).map((m): CandidateMatch => ({
      ...m,
      vacancyId:      m.vacancy?.id ?? m.vacancy_id ?? null,
      vacancyTitle:   m.vacancyTitle ?? m.vacancy?.title ?? m.vacancy_title ?? '',
      vacancyUrl:     m.vacancyUrl ?? m.vacancy?.url ?? m.vacancy_url ?? null,
      client:         m.client ?? m.customer?.name ?? m.client_name ?? '',
      score:          m.score ?? m.match_score ?? null,
      stage:          m.stageLabel ?? m.stage ?? null,
      stageColor:     m.stageColor ?? m.stage_color ?? null,
      contractStatus: m.contract_status ?? m.contractStatus ?? null,
      createdAt:      m.created_at ?? m.createdAt ?? null,
    })),
    notes:           c.notes ?? [],
    timeline:        (c.timeline ?? []).map(ev => ({
      ...ev,
      text: ev.text ?? ev.description,
      time: ev.time ?? ev.created_at,
    })),

    // ── Nested objects (detail only) ──
    preferences:     c.preferences ?? {},
    zzp:             c.zzp ?? {},
    planningSettings: c.planning_settings ?? {},
    // Channel consent (AVG, C-11): nested under `consent`. WhatsApp/e-mail default
    // true (operational opt-out), newsletter false (opt-in). `_at` is server-stamped.
    consent: {
      whatsapp_opt_in:       c.consent?.whatsapp_opt_in       ?? true,
      email_opt_in:          c.consent?.email_opt_in          ?? true,
      newsletter_opt_in:     c.consent?.newsletter_opt_in     ?? false,
      whatsapp_consent_at:   c.consent?.whatsapp_consent_at   ?? null,
      email_consent_at:      c.consent?.email_consent_at      ?? null,
      newsletter_consent_at: c.consent?.newsletter_consent_at ?? null,
    },

    // Tenant-defined custom field values — pass through as-is (key → value map).
    customFields: (c.custom_fields as Record<string, unknown>) ?? {},

    // ── Stats (detail only) — read from data.stats ──
    matchesCount:      c.stats?.matches_count ?? (c.matches ?? []).length,
    applicationsCount: c.stats?.applications_count ?? (c.applications ?? []).length,
    shiftsCount:       c.stats?.shifts_count,
    hoursWorked:       c.stats?.hours_worked,
  }
}
