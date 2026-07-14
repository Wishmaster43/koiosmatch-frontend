import type { VacancyDetail } from '@/types/vacancy'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'

// A bound-namespace translate function (the caller already resolved the namespace).
type Tx = (key: string, opts?: Record<string, unknown>) => string

// Whole days between an ISO date and now; null when the date is missing/unparseable
// so a bad or absent `created` never leaks into the copy as NaN.
function daysSince(iso: string | undefined, now: Date = new Date()): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000))
}

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
  const filledPct = Math.round((coreFields.filter(Boolean).length / coreFields.length) * 100)

  const days = daysSince(v.created, now)
  const appsCount = v.applicationsCount ?? 0

  return [
    {
      type: t('ai.completeness'),
      color: filledPct >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
      text: filledPct >= 80 ? t('ai.completeGood') : t('ai.completePartial', { pct: filledPct }),
    },
    {
      type: t('ai.flowLabel'),
      color: 'var(--color-secondary)',
      text: days === null
        ? t('ai.flowUnknown', { count: appsCount })
        : t('ai.flowOpen', { days, count: appsCount }),
    },
  ]
}
