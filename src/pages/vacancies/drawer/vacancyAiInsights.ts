// vacancyAiInsights — pure FE Koios heuristic insights for the vacancy drawer
// (field completeness + a days-open/application-count flow reading). See
// buildVacancyAdviceInsights below for the full field list and reasoning.
import type { VacancyDetail } from '@/types/vacancy'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'
import { completenessInsight } from '@/components/ai/completenessInsight'
// Shared day count from lib/localDate (side-effect-free; the datetime module would
// drag the i18n init into this pure builder). `futureAsZero` keeps the clamp this
// builder always had: a future `created` reads as 0 days, never as unknown.
import { daysSince } from '@/lib/localDate'

// A bound-namespace translate function (the caller already resolved the namespace).
type Tx = (key: string, opts?: Record<string, unknown>) => string

// Export daysSince so StatisticsTab's "days open" tile can reuse it (not a lane
// file — Rule E leaves the forward in place rather than editing it directly).
export { daysSince }

/**
 * buildVacancyAdviceInsights — Koios AI insights for the vacancy drawer:
 * field completeness over exactly the fields the Details tab edits (description,
 * salary, hours, skills, address/location, status) + a flow insight (days open +
 * application count, both measured from the detail payload). Pure FE heuristics,
 * no AI/API call.
 */
export function buildVacancyAdviceInsights(v: VacancyDetail, t: Tx, now: Date = new Date()): KoiosAdviceInsight[] {
  const coreFields = [
    v.description,
    v.salaryMin || v.salaryMax || v.salary,
    v.hoursMin || v.hoursMax || v.hours,
    (v.skills ?? []).length > 0,
    v.street || v.city || v.location,
    v.statusValue,
  ]
  const days = daysSince(v.created, now, true)
  const appsCount = v.applicationsCount ?? 0

  return [
    completenessInsight(coreFields, t),
    {
      type: t('ai.flowLabel'),
      color: 'var(--color-secondary)',
      text: days === null
        ? t('ai.flowUnknown', { count: appsCount })
        : t('ai.flowOpen', { days, count: appsCount }),
    },
  ]
}
