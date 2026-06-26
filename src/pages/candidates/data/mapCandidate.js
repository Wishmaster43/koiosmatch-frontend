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

// Bytes → human size ("44856" → "44 KB"). Backend sends documents.size in bytes.
const fmtSize = (b) => {
  if (b == null || b === '') return ''
  const n = Number(b)
  if (Number.isNaN(n)) return String(b)
  if (n < 1024)        return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// Newest-first sort for dated lists. Unparseable dates (dummy "period" strings)
// fall back to keeping order (stable sort); ongoing items sort to the top.
const dateVal = (v) => { if (!v) return 0; const t = new Date(v).getTime(); return Number.isNaN(t) ? 0 : t }
const byNewest = (list, getKey) => [...list].sort((a, b) => getKey(b) - getKey(a))

export function mapCandidate(c) {
  const name = c.name || c.full_name
    || [c.firstname, c.lastname].filter(Boolean).join(' ')
    || [c.first_name, c.last_name].filter(Boolean).join(' ') || '?'

  const ownerName = c.owner?.name ?? c.recruiter?.name ?? c.owner_name ?? ''

  // Contract form is MULTI-value (English slugs: on_call, freelance, payroll, …).
  // Accept an array from the API, or fall back to a single legacy field as array.
  const rawTypes = c.candidate_types ?? c.candidate_type ?? c.employment_type ?? c.type ?? []
  const candidateTypes = (Array.isArray(rawTypes) ? rawTypes : [rawTypes])
    .map(t => (typeof t === 'object' ? (t.value ?? t.id ?? t.name) : t))
    .filter(Boolean)

  const stats = c.stats ?? {}

  return {
    id:              c.id,
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
    // Operational status (single slug: active | inactive | …).
    status:          c.status ?? '',
    // Availability — separate axis from status (single slug, null until set).
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
    branches:        c.branches ?? [],
    // Talent pools the candidate belongs to. Each: { id, name, color, source? }.
    // Accepts bare slugs/strings too (normalised to { id?, name }).
    pools:           (c.pools ?? []).map(p => (typeof p === 'object' ? p : { name: p })),
    // Koios AI advice, precomputed server-side (background job). Shape:
    // { action: 'add_to_pool'|'contact'|'plan_intake'|'none', label?, reason?, score?, pool_hint? }.
    koiosAdvice:     c.koios_advice ?? c.koiosAdvice ?? null,

    // ── Relations (detail only) — normalise snake_case → camelCase, newest first ──
    experiences:     byNewest(c.experiences ?? c.work_experience ?? [],
      e => e.current ? Infinity : Math.max(dateVal(e.end_date ?? e.end), dateVal(e.start_date ?? e.start))),
    educations:      byNewest(c.educations ?? c.education ?? [],
      e => e.in_progress ? Infinity : Math.max(dateVal(e.end_date ?? e.end), dateVal(e.issue_date ?? e.issued), dateVal(e.start_date ?? e.start))),
    languages:       (c.languages ?? []).map(l => ({
      ...l,
      spoken:  l.spoken  ?? l.spoken_level,
      written: l.written ?? l.written_level,
    })),
    certifications:  byNewest(
      (c.certifications ?? []).map(x => ({
        ...x,
        org:     x.org     ?? x.organisation,
        issued:  x.issued  ?? x.issue_date,
        expires: x.expires ?? x.expiry_date,
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
    matches:         (c.matches ?? []).map(m => ({
      ...m,
      vacancyTitle:   m.vacancyTitle ?? m.vacancy?.title ?? m.vacancy_title ?? '',
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
    // Channel consent (AVG opt-in): per-channel flag + the moment it was given.
    // Flags default off; `_at` is set server-side when a flag flips on.
    consent: {
      whatsapp_consent:      c.whatsapp_consent      ?? false,
      email_consent:         c.email_consent         ?? false,
      newsletter_consent:    c.newsletter_consent    ?? false,
      whatsapp_consent_at:   c.whatsapp_consent_at   ?? null,
      email_consent_at:      c.email_consent_at      ?? null,
      newsletter_consent_at: c.newsletter_consent_at ?? null,
    },

    // ── Stats (detail only) — read from data.stats ──
    matchesCount:      stats.matches_count ?? (c.matches ?? []).length,
    applicationsCount: stats.applications_count ?? (c.applications ?? []).length,
    shiftsCount:       stats.shifts_count,
    hoursWorked:       stats.hours_worked,
  }
}
