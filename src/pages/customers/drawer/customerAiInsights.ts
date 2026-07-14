import type { Customer, Location } from '@/types/customer'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'

// A bound-namespace translate function (the caller already resolved the namespace).
type Tx = (key: string, opts?: Record<string, unknown>) => string

// KvK/BTW/contact info live on a Location, not on the flat Customer shape —
// prefer the headquarters location, fall back to the first one (mirrors how
// LocationsTab treats "the" address when several locations exist).
function primaryLocation(c: Customer): Location | undefined {
  return c.locations.find(l => l.isHeadquarter) ?? c.locations[0]
}

/**
 * buildCustomerAdviceInsights — Koios AI insights for the customer drawer:
 * completeness over the company fields (industry/website/employee count/
 * description) plus the primary location's KvK/BTW/contact info, and a
 * relationship insight from the open-vacancies/active-matches counts the
 * detail payload already carries. Pure FE heuristics, no AI/API call.
 *
 * Payload gap: Customer has no top-level "last activity" timestamp today —
 * only `created` (customer since). Until the API exposes one, the relationship
 * insight stays limited to the counts that are actually on the payload.
 */
export function buildCustomerAdviceInsights(c: Customer, t: Tx): KoiosAdviceInsight[] {
  const loc = primaryLocation(c)
  const coreFields = [
    c.industry, c.website, c.employeeCount, c.description,
    loc?.cocNumber, loc?.vatNumber, loc?.phone || loc?.email || loc?.contactName,
  ]
  const filledPct = Math.round((coreFields.filter(Boolean).length / coreFields.length) * 100)

  const openVacancies = c.openVacanciesCount ?? 0
  const activeMatches = c.activeMatchesCount ?? 0
  const hasActivity = openVacancies > 0 || activeMatches > 0

  return [
    {
      type: t('ai.completeness'),
      color: filledPct >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
      text: filledPct >= 80 ? t('ai.completeGood') : t('ai.completePartial', { pct: filledPct }),
    },
    {
      type: t('ai.relationshipLabel'),
      color: 'var(--color-secondary)',
      text: hasActivity
        ? t('ai.relationshipActive', { vacancies: openVacancies, matches: activeMatches })
        : t('ai.relationshipNone'),
    },
  ]
}
