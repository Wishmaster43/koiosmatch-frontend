/**
 * mapCandidate — the SINGLE place that turns a raw API candidate record into the
 * shape the UI works with. Both the list/drawer and the CV generator consume this.
 *
 * The backend is snake_case and uses the 3-layer model (candidate_types[] · funnel_type
 * · status, all English slugs — labels/colours come from the lookups API). Detail
 * responses (GET /candidates/{id}) carry the relations + stats + timeline; the list
 * is intentionally light. The `?? ` fallbacks also keep the dummy data working.
 */
const initialsOf = (name) =>
  name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'

// Bytes → human size ("44856" → "44 KB"). Backend sends documents.size in bytes.
const fmtSize = (b) => {
  if (b == null || b === '') return ''
  const n = Number(b)
  if (Number.isNaN(n)) return String(b)
  if (n < 1024)        return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

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
    // Funnel stage (single slug: prospect | intake | pool | alumni).
    stage:           c.funnel_type ?? c.stage ?? c.lifecycle ?? '',
    stageVacancyId:  c.funnel_vacancy_id ?? c.stage_vacancy_id ?? c.vacancy_id ?? '',
    // Operational status (single slug: active | inactive | …).
    status:          c.status ?? '',
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

    // ── Relations (detail only) — normalise snake_case → the camelCase the tabs use ──
    experiences:     c.experiences ?? c.work_experience ?? [],
    educations:      c.educations ?? c.education ?? [],
    languages:       (c.languages ?? []).map(l => ({
      ...l,
      spoken:  l.spoken  ?? l.spoken_level,
      written: l.written ?? l.written_level,
    })),
    certifications:  (c.certifications ?? []).map(x => ({
      ...x,
      org:     x.org     ?? x.organisation,
      issued:  x.issued  ?? x.issue_date,
      expires: x.expires ?? x.expiry_date,
    })),
    skills:          c.skills ?? [],
    documents:       (c.documents ?? []).map(d => ({
      ...d,
      name: d.name ?? d.file_name,
      size: typeof d.size === 'string' && /\D/.test(d.size) ? d.size : fmtSize(d.size),
      url:  d.url,
      type: d.type ?? null,
    })),
    applications:    c.applications ?? [],
    placements:      (c.placements ?? []).map(p => ({
      ...p,
      hourlyRate:       p.hourlyRate       ?? p.hourly_rate,
      hoursPerWeek:     p.hoursPerWeek      ?? p.hours_per_week,
      contractType:     p.contractType     ?? p.contract_type,
      contractDuration: p.contractDuration ?? p.contract_duration,
      startDate:        p.startDate        ?? p.start_date,
      endDate:          p.endDate          ?? p.end_date,
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

    // ── Stats (detail only) — read from data.stats ──
    placementsCount:   stats.placements_count   ?? (c.placements ?? []).length,
    applicationsCount: stats.applications_count ?? (c.applications ?? []).length,
    shiftsCount:       stats.shifts_count,
    hoursWorked:       stats.hours_worked,
  }
}
