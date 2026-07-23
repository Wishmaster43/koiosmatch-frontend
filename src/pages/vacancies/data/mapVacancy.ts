import { initialsOf } from '@/lib/initials'
import { toCoord } from '@/lib/coords'
import type { Id, Loose } from '@/types/common'
import type { ApiVacancy, Vacancy, VacancyDetail } from '@/types/vacancy'

// Sum the per-phase application counts into a single total.
const sumPhases = (byPhase: Loose): number =>
  Object.values(byPhase).reduce<number>((a, b) => a + (Number(b) || 0), 0)

/**
 * mapVacancy — raw API vacancy → the flat shape the list/table renders.
 *
 * Snake_case-tolerant and defensive about field names (the /vacancies endpoint is
 * not built yet — see docs/worklist.md C-26), so it accepts several spellings and
 * never throws on a missing field. Mirrors mapCandidate / mapApplication.
 */
export function mapVacancy(v: ApiVacancy = {}): Vacancy {
  const owner: { id?: Id; name?: string; avatar_color?: string | null; color?: string | null } = v.owner ?? {}
  const customer: { id?: Id; name?: string } = v.customer ?? v.client ?? {}
  const status: { value?: string | number; label?: string; color?: string } =
    (typeof v.status === 'object' && v.status) ? v.status : {}
  const byPhase: Loose = v.applications_by_phase ?? v.applicationsByPhase ?? {}
  // VAC-AGENT-1: the linked AI agent — nested object on the list row, falling back
  // to a flat id (e.g. an optimistic local patch that only carries the id).
  const aiAgent: { id?: Id; name?: string } | null = v.ai_agent ?? null

  return {
    id: v.id,
    code: v.code ?? v.reference ?? '',
    // NUMMER-1: human-readable reference number (V-12) — distinct from the manual code above.
    referenceNumber: v.reference_number ?? '',
    title: v.title ?? '—',
    // Status carries its own label + colour from the tenant lookup.
    statusValue: status.value ?? v.status_value ?? (typeof v.status === 'string' ? v.status : null),
    statusLabel: status.label ?? v.status_label ?? '',
    // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice (mirrors Avatar.tsx's identical constant)
    statusColor: status.color ?? v.status_color ?? '#9CA3AF',
    leadsCount: v.leads_count ?? v.leadsCount ?? 0,
    applicationsCount: v.applications_count ?? v.applicationsCount ?? sumPhases(byPhase),
    applicationsByPhase: byPhase,
    published: Boolean(v.published ?? false),
    publishedChannels: v.published_channels ?? v.publishedChannels ?? [],
    owner: {
      id: owner.id ?? v.owner_id ?? null,
      name: owner.name ?? v.owner_name ?? '',
      initials: initialsOf(owner.name ?? v.owner_name ?? ''),
      color: owner.avatar_color ?? owner.color ?? null,
    },
    clientId: customer.id ?? v.customer_id ?? v.client_id ?? null,
    clientName: customer.name ?? v.customer_name ?? v.client_name ?? '',
    tags: v.tags ?? [],
    created: v.created_at ?? v.createdAt ?? '',
    createdSort: v.created_at ?? v.createdAt ?? '',
    // City + STRAAL-1 geo — the map view plots list rows once the API sends these.
    // PDOK-LATLNG-1: tolerant coercion — Laravel decimals arrive as strings (see lib/coords).
    city: v.city ?? '',
    lat: toCoord(v.lat),
    lng: toCoord(v.lng),
    distanceKm: toCoord(v.distance_km),
    // VAC-DATES-1: runtime window, already YYYY-MM-DD (Carbon::toDateString()) —
    // the exact shape a native <input type="date"> reads/writes.
    startDate: v.start_date ?? '',
    endDate: v.end_date ?? '',
    // Archive state (soft-delete) — the FE archived-toggle (include_archived=1)
    // surfaces these rows; mirror candidates so the row renders the soft chip.
    archived: Boolean(v.archived ?? (v.deleted_at != null)),
    archivedAt: v.deleted_at ?? null,
    // VAC-AGENT-1: linked AI agent (Option A: linking IS the interview toggle for
    // this vacancy) + the flow id it carries — present on both list and detail.
    aiAgentId: aiAgent?.id ?? v.ai_agent_id ?? null,
    aiAgentName: aiAgent?.name ?? '',
    interviewFlowId: v.interview_flow_id ?? null,
  }
}

// Build a display string from min/max + a unit, falling back to a preformatted field.
const range = (preformatted: unknown, min: unknown, max: unknown, suffix = ''): string => {
  if (preformatted) return String(preformatted)
  if (min == null && max == null) return ''
  const fmt = (n: unknown) => (n == null ? '' : String(n))
  return [fmt(min), fmt(max)].filter(v => v !== '').join(' – ') + (suffix ? ` ${suffix}` : '')
}

// Resolve a lookup value that may arrive as an object {label/name/value} or a scalar.
const labelOf = (x: unknown): string => {
  if (x && typeof x === 'object') {
    const o = x as Loose
    return String(o.label ?? o.name ?? o.value ?? '')
  }
  return x == null ? '' : String(x)
}

// Resolve the raw slug/value of a lookup (object → value/id, scalar → itself).
const valueOf = (x: unknown): string => {
  if (x && typeof x === 'object') {
    const o = x as Loose
    return String(o.value ?? o.id ?? '')
  }
  return x == null ? '' : String(x)
}

// Numeric-ish field → string for the form (empty when absent).
const numStr = (x: unknown): string => (x == null ? '' : String(x))

/**
 * mapVacancyDetail — raw API detail (GET /vacancies/{id}) → the enriched shape the
 * drawer tabs render. Builds on mapVacancy and normalises the nested objects
 * (employment/seniority/education lookups, applications, custom fields, timeline…).
 * Every nested list defaults to [] so a tab never crashes.
 */
export function mapVacancyDetail(raw: ApiVacancy = {}): VacancyDetail {
  const base = mapVacancy(raw)

  // V25 fix: GET /vacancies/{id} never attaches applications_by_phase/applications_count
  // (VacancyController::show() has no attachApplicationCounts() call — only index() does),
  // so a fresh detail fetch always came back with an empty breakdown ("Statistieken leeg" /
  // ApplicantsTab's per-phase chips empty too). The full coupled-applications list IS loaded
  // on the detail endpoint (raw.applications), so derive the same counts from it here — the
  // exact same real records, just aggregated for this one record (not a page-scope guess).
  const rawApplications = Array.isArray(raw.applications) ? raw.applications : []
  const phaseFromApplications: Loose = {}
  rawApplications.forEach(a => {
    const key = a.phase?.value ?? a.phase_key ?? a.stage
    if (key != null) phaseFromApplications[String(key)] = (Number(phaseFromApplications[String(key)]) || 0) + 1
  })
  const hasAttachedPhaseCounts = Object.keys(base.applicationsByPhase as Loose).length > 0
  const applicationsByPhase = hasAttachedPhaseCounts ? base.applicationsByPhase : phaseFromApplications
  const applicationsCount = base.applicationsCount || rawApplications.length

  return {
    ...base,
    applicationsByPhase,
    applicationsCount,
    // Raw values for the in-place editor (bind selects to these, show the labels above).
    seniorityValue: valueOf(raw.seniority),
    educationValue: valueOf(raw.education),
    // Contract forms (multi) — same lookup as the candidate.
    contractTypes: Array.isArray(raw.contract_types) ? raw.contract_types.map(String) : [],
    // Structured address for the in-place editor.
    street: raw.street ?? '',
    houseNumber: raw.house_number ?? '',
    houseNumberSuffix: raw.house_number_suffix ?? '',
    postalCode: raw.postcode ?? raw.postal_code ?? '',
    city: raw.city ?? '',
    // VAC-COUNTRY-1 (Danny 22-07, punt 2): read the raw DB column name first, then
    // the already-mapped key the resource sends today — whichever arrives. Honest:
    // the internal VacancyDetailResource does not serialize `location_country` /
    // `country` yet (BE gap, CMBE follow-up), so `country` reads '' until that lands.
    province: raw.location_province ?? raw.province ?? '',
    country: raw.location_country ?? raw.country ?? '',
    // STRAAL-1: geocoded coordinates + radius distance from the server (tolerant, see lib/coords).
    lat: toCoord(raw.lat),
    lng: toCoord(raw.lng),
    distanceKm: toCoord(raw.distance_km),
    experienceMin: numStr(raw.experience_min_years),
    experienceMax: numStr(raw.experience_max_years),
    salaryMin: numStr(raw.salary_min),
    salaryMax: numStr(raw.salary_max),
    hoursMin: numStr(raw.hours_min),
    hoursMax: numStr(raw.hours_max),
    location: raw.location ?? '',
    salary: range(raw.salary, raw.salary_min, raw.salary_max, raw.salary_period ?? ''),
    hours: range(raw.hours, raw.hours_min, raw.hours_max, raw.hours_unit ?? ''),
    experience: raw.experience ?? (raw.experience_years != null ? String(raw.experience_years) : ''),
    seniority: labelOf(raw.seniority) || raw.seniority_label || '',
    education: labelOf(raw.education) || raw.education_label || '',
    industry: labelOf(raw.industry) || raw.industry_label || '',
    category: labelOf(raw.function) || raw.category || raw.function_title || '',
    skills: raw.skills ?? [],
    description: raw.description ?? '',
    // VAC-CASCADE-1 (backend wave 6): the persisted klant → locatie → afdeling →
    // contactpersoon cascade — ids seed the in-place editor's pickers, names seed
    // the read-mode rows (both empty when never picked).
    customerLocationId: raw.customer_location_id != null ? String(raw.customer_location_id) : '',
    customerLocationName: raw.customer_location?.name ?? '',
    customerDepartmentId: raw.customer_department_id != null ? String(raw.customer_department_id) : '',
    customerDepartmentName: raw.customer_department?.name ?? '',
    contactId: raw.contact_id != null ? String(raw.contact_id) : '',
    contactName: raw.contact?.name ?? '',
    // Per-vacancy application settings (cv/cover_letter/photo/remarks/interview_consent → required|optional|hidden).
    applicationSettings: raw.application_settings ?? {},
    // Per-vacancy AI matching weights (6 dimensions, int 1..5) for the Matching tab.
    // (Global matcher strictness lives in /settings/matching, not on the vacancy.)
    matchWeights: raw.match_weights ?? {},
    // MATCH-TEMPLATE-1: provenance only (snapshot semantics) — never a live link.
    matchWeightTemplateId: raw.match_weight_template_id ?? null,
    // Job-board channels with their published state. CHANNEL-ICON-1: key/icon ride
    // along (undefined on a pre-migration row) so channelIcons.ts maps exactly.
    channels: (raw.channels ?? raw.published_channels ?? []).map(c => ({
      value: c.value ?? c.key ?? c.id, label: c.label ?? c.name ?? '', published: Boolean(c.published),
      key: c.key != null ? String(c.key) : undefined, icon: c.icon ?? undefined,
    })),
    // Coupled applications (each links a real candidate at a funnel phase).
    applications: (raw.applications ?? []).map(a => {
      const cand: { id?: Id; name?: string; initials?: string } = a.candidate ?? {}
      const name = a.candidate_name ?? cand.name ?? '—'
      const phase: { value?: string | number; label?: string; color?: string } = a.phase ?? {}
      return {
        id: a.id,
        candidateId: a.candidate_id ?? cand.id ?? null,
        candidateName: name,
        candidateInitials: cand.initials ?? (name !== '—' ? initialsOf(name) : '?'),
        phaseValue: phase.value ?? a.phase_key ?? a.stage ?? null,
        phaseLabel: phase.label ?? a.phase_label ?? '',
        // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice (mirrors Avatar.tsx's identical constant)
        phaseColor: phase.color ?? a.phase_color ?? '#9CA3AF',
        source: a.source ?? '',
        created: a.created_at ?? '',
      }
    }),
    customFields: (Array.isArray(raw.custom_fields) ? raw.custom_fields : []).map(f => ({ id: f.id, name: f.name ?? f.label ?? '', value: f.value ?? '' })),
    // Custom-field values as a map (backend may send custom_fields as an object, or a
    // separate custom_field_values map) — used by the Extra tab.
    customFieldValues: (() => {
      const cf = raw.custom_fields as unknown
      if (cf && typeof cf === 'object' && !Array.isArray(cf)) return cf as Record<string, unknown>
      return (raw.custom_field_values ?? {}) as Record<string, unknown>
    })(),
    documents: (raw.documents ?? []).map(d => ({ id: d.id, name: d.name ?? '', size: d.size ?? '' })),
    timeline: (raw.timeline ?? []).map(ev => ({
      id: ev.id, author: ev.author ?? '', initials: ev.author_initials ?? initialsOf(ev.author ?? ''),
      description: ev.description ?? '', ai: Boolean(ev.ai), time: ev.created_at ?? ev.time ?? '',
    })),
    // V24 fix: VacancyNoteController's shared shape returns the note body as `body`
    // (the DB column is `text`, but the API contract mirrors the shared notes shape,
    // { id, author, body, type, created_at }) — reading `n.text` left every note
    // blank after a real fetch/reload (only the just-added optimistic row showed).
    notes: (raw.notes ?? []).map(n => ({ id: n.id, author: n.author ?? '', text: String((n as Loose).body ?? n.text ?? ''), time: n.created_at ?? '' })),
  }
}
