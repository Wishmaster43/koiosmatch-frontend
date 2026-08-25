/**
 * customerAiInsights — pure FE heuristics behind the customer drawer's Koios AI
 * block: field-completeness scoring and a relationship-activity read, both
 * computed from the detail payload already on screen (no AI/API call).
 */
import type { Customer, Location } from '@/types/customer'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'

// A bound-namespace translate function (the caller already resolved the namespace).
type Tx = (key: string, opts?: Record<string, unknown>) => string

// Fallback only. The customer now carries its OWN KvK/BTW/address (KLANT-ADRES-1 +
// KLANT-KVK-1, backend 28-07), so the advice judges the CUSTOMER first and only falls
// back to a location for records created before those columns existed — otherwise a
// fully-filled customer would still be scored on a location's empty fields.
function primaryLocation(c: Customer): Location | undefined {
  // The LIST payload carries only locations_count; the array arrives with the
  // detail fetch — this builder can run in between (smoke 16-07: hard crash).
  return (c.locations ?? [])[0]
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
  // Customer-first, location-as-fallback (see primaryLocation): the address counts as
  // filled once street+city are there, which is what "we can find this company" means.
  const coreFields = [
    c.industry, c.website, c.employeeCount, c.description,
    c.cocNumber || loc?.cocNumber,
    c.vatNumber || loc?.vatNumber,
    (c.street && c.city) || loc?.address,
    c.phone || c.email || loc?.phone || loc?.email || loc?.contactName,
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
