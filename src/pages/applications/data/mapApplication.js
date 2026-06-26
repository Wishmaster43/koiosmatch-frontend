import { bucketOfPhase } from './applicationsShared'

import { initialsOf } from '@/lib/initials'

/**
 * mapApplication — raw API application → the flat shape the table/board/drawer
 * render. Snake_case-tolerant and defensive about the exact field names (the
 * /applications endpoint is not built yet — see docs/worklist.md), so it accepts
 * several spellings and never throws on a missing field.
 */
export function mapApplication(a = {}) {
  const cand = a.candidate ?? {}
  const joined = [cand.first_name, cand.last_name].filter(Boolean).join(' ')
  const candidateName = a.candidate_name ?? cand.name ?? (joined || '—')

  const vacancy = a.vacancy ?? {}
  const owner = a.owner ?? {}

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
    score: a.score ?? a.match_score ?? a.match?.overall ?? null,
    task: a.task ?? a.ai_task ?? a.ai?.task ?? '',
    phaseKey,
    bucket: a.bucket ?? bucketOfPhase(phaseKey),
    source: a.source ?? a.source_name ?? '',
    owner: {
      name: owner.name ?? a.owner_name ?? '',
      initials: initialsOf(owner.name ?? a.owner_name ?? ''),
      color: owner.avatar_color ?? null,
    },
    candidateStatusLabel: a.candidate_status_label ?? cand.status_label ?? '',
    candidateStatusColor: a.candidate_status_color ?? cand.status_color ?? '#9CA3AF',
    created: a.created_at ?? a.applied_at ?? '',
    isNew: Boolean(a.is_new ?? false),
  }
}

/**
 * mapApplicationDetail — raw API detail (GET /applications/{id}) → the enriched
 * shape the drawer tabs render. Builds on mapApplication and normalises the
 * nested objects (candidate, vacancy, interviews, appointments, timeline, match).
 * Defensive: every nested list defaults to [] so a tab never crashes.
 */
export function mapApplicationDetail(raw = {}) {
  const base = mapApplication(raw)
  const cand = raw.candidate ?? {}
  const vac = raw.vacancy ?? {}

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
      employmentType: vac.employment_type ?? '', location: vac.location ?? '',
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
    appointments: (raw.appointments ?? []).map(ap => ({
      id: ap.id, type: ap.type ?? '', title: ap.title ?? '',
      when: ap.scheduled_at ?? ap.when ?? '', with: ap.owner?.name ?? ap.with ?? '',
      status: ap.status ?? 'planned',
    })),
    timeline: (raw.timeline ?? []).map(ev => ({
      id: ev.id, author: ev.author ?? '', initials: ev.author_initials ?? '',
      description: ev.description ?? '', ai: Boolean(ev.ai), time: ev.created_at ?? ev.time ?? '',
    })),
    notes: (raw.notes ?? []).map(n => ({
      id: n.id, author: n.author ?? '', text: n.text ?? '', time: n.created_at ?? '',
    })),
    // Match SCORE = the fit on the application (flat fields; "match" the noun is a
    // separate entity). `score` (overall) comes from mapApplication (match_score).
    matchCriteria: raw.match_criteria ?? raw.match?.criteria ?? [],
    matchSummary: raw.match_summary ?? raw.match?.summary ?? '',
    // AI vs manual override (the AI's own score is kept when overridden).
    matchSource: raw.match_score_source ?? 'ai',
    aiScore: raw.ai_match_score ?? null,
  }
}
