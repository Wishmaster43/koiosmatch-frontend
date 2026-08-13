import type { Vacancy } from '@/types/vacancy'

/**
 * vacancyAdvice — the ONE deterministic rule engine behind the vacancies table's
 * "Koios" column. Mirrors candidateAdvice.ts's reference design: rules only read
 * fields the LIST row already carries (published, publishedAt, applicationsCount, createdSort,
 * archived) — no new fetch, no invented data.
 */

export type VacancyAdviceAction = 'attention' | 'none'

export interface VacancyAdviceRule {
  action: VacancyAdviceAction
  reasonKey: string
  reasonParams?: Record<string, string | number>
}

export interface VacancyAdviceOptions {
  // Tenant-configurable "how many days without an application counts as stale"
  // (mirrors candidates' no_contact_alert_months threshold).
  staleDays: number
  // Injectable for deterministic tests; defaults to the real clock at call time.
  now?: Date
}

const NONE_RULE: VacancyAdviceRule = { action: 'none', reasonKey: 'koios.reasons.none' }

// First-match-wins priority ladder — see the file header for the read-set constraint.
export function deriveVacancyAdvice(v: Vacancy, opts: VacancyAdviceOptions): VacancyAdviceRule {
  // Rule 1: no advice on an archived vacancy — it is no longer being worked.
  if (v.archived) return NONE_RULE

  // Rule 2: a draft/unpublished vacancy has no candidates to attract yet — an
  // empty pipeline there is expected, not a signal.
  if (!v.published) return NONE_RULE

  // Rule 3: published, zero applications, older than the stale threshold —
  // Danny's own example rule ("geen sollicitaties + ouder dan X → Aandacht").
  // Clock parity with the BE stale_online stat (wave 2, 13-08): the server counts
  // from COALESCE(published_at, created_at) — measure from the same moment, or the
  // KPI tile and this row badge disagree on republished vacancies.
  const days = daysSince(v.publishedAt || v.createdSort || v.created, opts.now ?? new Date())
  if ((v.applicationsCount ?? 0) === 0 && days != null && days >= opts.staleDays) {
    return { action: 'attention', reasonKey: 'koios.reasons.staleNoApplications', reasonParams: { days } }
  }

  // Rule 4: nothing to flag.
  return NONE_RULE
}

// Whole-day difference between a date string and now; null when the date is unreadable.
function daysSince(dateStr: string, now: Date): number | null {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}
