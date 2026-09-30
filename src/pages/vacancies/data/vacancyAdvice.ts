import type { Vacancy } from '@/types/vacancy'
import { daysSince } from '@/lib/localDate'
import { windowDays, windowBoundaryBefore, type WindowUnit } from '@/lib/windowUnit'

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
  // WINDOW-UNIT-READERS-1: the unit `staleDays` is expressed in (days/workdays/
  // weeks/months, mirrors the backend's WindowUnit) — defaults to 'days' so an
  // untenanted/legacy caller behaves exactly as before.
  staleUnit?: WindowUnit
  // Injectable for deterministic tests; defaults to the real clock at call time.
  now?: Date
}

const NONE_RULE: VacancyAdviceRule = { action: 'none', reasonKey: 'koios.reasons.none' }

// First-match-wins priority ladder  for the read-set constraint.
export function deriveVacancyAdvice(v: Vacancy, opts: VacancyAdviceOptions): VacancyAdviceRule {
  // Rule 1: no advice on an archived vacancy — it is no longer being worked.
  if (v.archived) return NONE_RULE

  // Rule 2: a draft/unpublished vacancy has no candidates to attract yet — an
  // empty pipeline there is expected, not a signal.
  if (!v.published) return NONE_RULE

  // Rule 3: published, zero applications, older than the stale threshold —
  // Danny's own example rule ("no applications + older than X → Attention").
  // Clock parity with the BE stale_online stat (wave 2, 13-08): the server counts
  // from COALESCE(published_at, created_at) — measure from the same moment, or the
  // KPI tile and this row badge disagree on republished vacancies.
  const now = opts.now ?? new Date()
  const publishedAtRaw = v.publishedAt || v.createdSort || v.created
  const days = daysSince(publishedAtRaw, now)
  // Boundary comparison honours the tenant's unit (weeks/months/workdays) at the
  // same DAY granularity as the old rule (`days >= staleDays`): windowDays() turns
  // the boundary back into whole days (round for days/weeks/months, floor for the
  // start-of-day workdays walk), so the `days` unit is exactly the old truth in
  // every timezone, DST hour included.
  const unit = opts.staleUnit ?? 'days'
  const boundary = windowBoundaryBefore(now, opts.staleDays, unit)
  const isStale = days != null && days >= windowDays(now, boundary, unit)
  if ((v.applicationsCount ?? 0) === 0 && isStale && days != null) {
    return { action: 'attention', reasonKey: 'koios.reasons.staleNoApplications', reasonParams: { days } }
  }

  // Rule 4: nothing to flag.
  return NONE_RULE
}
