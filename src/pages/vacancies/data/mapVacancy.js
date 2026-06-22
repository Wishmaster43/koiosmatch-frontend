// Two-letter initials from a name, e.g. "Kelly van Vliet" → "KV".
const initialsOf = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

// Sum the per-phase application counts into a single total.
const sumPhases = (byPhase) => Object.values(byPhase ?? {}).reduce((a, b) => a + (Number(b) || 0), 0)

/**
 * mapVacancy — raw API vacancy → the flat shape the list/table renders.
 *
 * Snake_case-tolerant and defensive about field names (the /vacancies endpoint is
 * not built yet — see docs/worklist.md C-26), so it accepts several spellings and
 * never throws on a missing field. Mirrors mapCandidate / mapApplication.
 */
export function mapVacancy(v = {}) {
  const owner = v.owner ?? {}
  const customer = v.customer ?? v.client ?? {}
  const status = typeof v.status === 'object' && v.status ? v.status : {}
  const byPhase = v.applications_by_phase ?? v.applicationsByPhase ?? {}

  return {
    id: v.id,
    code: v.code ?? v.reference ?? '',
    title: v.title ?? '—',
    // Status carries its own label + colour from the tenant lookup.
    statusValue: status.value ?? v.status_value ?? (typeof v.status === 'string' ? v.status : null),
    statusLabel: status.label ?? v.status_label ?? '',
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
  }
}

// Build a display string from min/max + a unit, falling back to a preformatted field.
const range = (preformatted, min, max, suffix = '') => {
  if (preformatted) return preformatted
  if (min == null && max == null) return ''
  const fmt = (n) => (n == null ? '' : n)
  return [fmt(min), fmt(max)].filter(v => v !== '').join(' – ') + (suffix ? ` ${suffix}` : '')
}

/**
 * mapVacancyDetail — raw API detail (GET /vacancies/{id}) → the enriched shape the
 * drawer tabs render. Builds on mapVacancy and normalises the nested objects
 * (employment/seniority/education lookups, applications, custom fields, timeline…).
 * Every nested list defaults to [] so a tab never crashes.
 */
export function mapVacancyDetail(raw = {}) {
  const base = mapVacancy(raw)
  const labelOf = (x) => (typeof x === 'object' && x ? (x.label ?? x.name ?? x.value) : x) ?? ''

  return {
    ...base,
    employmentLabel: labelOf(raw.employment_type) || raw.employment_type_label || '',
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
    // Per-vacancy application settings (cv/cover_letter/photo/remarks/interview_consent → required|optional|hidden).
    applicationSettings: raw.application_settings ?? {},
    // Per-vacancy AI matching weights (6 dimensions, int 1..5) for the Matching tab.
    matchWeights: raw.match_weights ?? {},
    // Job-board channels with their published state.
    channels: (raw.channels ?? raw.published_channels ?? []).map(c => ({
      value: c.value ?? c.key ?? c.id, label: c.label ?? c.name ?? '', published: Boolean(c.published),
    })),
    // Coupled applications (each links a real candidate at a funnel phase).
    applications: (raw.applications ?? []).map(a => {
      const cand = a.candidate ?? {}
      const name = a.candidate_name ?? cand.name ?? '—'
      const phase = a.phase ?? {}
      return {
        id: a.id,
        candidateId: a.candidate_id ?? cand.id ?? null,
        candidateName: name,
        candidateInitials: cand.initials ?? (name !== '—' ? initialsOf(name) : '?'),
        phaseValue: phase.value ?? a.phase_key ?? a.stage ?? null,
        phaseLabel: phase.label ?? a.phase_label ?? '',
        phaseColor: phase.color ?? a.phase_color ?? '#9CA3AF',
        source: a.source ?? '',
        created: a.created_at ?? '',
      }
    }),
    customFields: (raw.custom_fields ?? []).map(f => ({ id: f.id, name: f.name ?? f.label ?? '', value: f.value ?? '' })),
    documents: (raw.documents ?? []).map(d => ({ id: d.id, name: d.name ?? '', size: d.size ?? '' })),
    timeline: (raw.timeline ?? []).map(ev => ({
      id: ev.id, author: ev.author ?? '', initials: ev.author_initials ?? initialsOf(ev.author ?? ''),
      description: ev.description ?? '', ai: Boolean(ev.ai), time: ev.created_at ?? ev.time ?? '',
    })),
    notes: (raw.notes ?? []).map(n => ({ id: n.id, author: n.author ?? '', text: n.text ?? '', time: n.created_at ?? '' })),
  }
}
