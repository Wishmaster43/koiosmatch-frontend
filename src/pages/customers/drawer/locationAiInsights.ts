import type { Location } from '@/types/customer'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'

// A bound-namespace translate function (the caller already resolved the namespace).
type Tx = (key: string, opts?: Record<string, unknown>) => string

/**
 * buildLocationAdviceInsights — the Koios advice block on a location's own tab, so a
 * location reads like the customer's Bedrijf tab (Danny 28-07: "zelfde format als klant").
 *
 * Pure frontend heuristics over the fields this site actually has — no AI, no API call,
 * exactly like buildCustomerAdviceInsights next to it. It deliberately scores only what
 * `customer_locations` can store: there is no description column and no branch-links
 * endpoint for a location, so this block never claims anything about them.
 *
 * "Findable" means street + city: a postcode alone does not put a nurse at the door.
 */
export function buildLocationAdviceInsights(l: Location, t: Tx): KoiosAdviceInsight[] {
  const coreFields = [
    l.street && l.city,
    l.postalCode,
    l.cocNumber,
    l.vatNumber,
    l.contactName,
    l.phone || l.email,
  ]
  const filledPct = Math.round((coreFields.filter(Boolean).length / coreFields.length) * 100)

  return [
    {
      type: t('ai.completeness'),
      color: filledPct >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
      text: filledPct >= 80 ? t('ai.locationComplete') : t('ai.locationPartial', { pct: filledPct }),
    },
  ]
}
