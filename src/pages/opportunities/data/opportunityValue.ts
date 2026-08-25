/**
 * Shared opportunity "value" cell logic — picks hours vs euro per the tenant's
 * `opportunity_value_in_hours` setting and formats it. Extracted so the
 * OpportunitiesTable (page) and the customer drawer's OpportunitiesTab can
 * never drift again (K10c: the drawer tab kept showing euro while the page
 * already respected the hours setting).
 */
import type { TFunction } from 'i18next'
import type { Opportunity } from '@/types/opportunity'
import { formatCurrency } from '@/lib/formatters'

// Picks the raw numeric value (hours or euro) a row should sort/display by.
export function opportunityValueOf(row: Pick<Opportunity, 'value' | 'hours'>, valueInHours: boolean): number | null | undefined {
  return valueInHours ? row.hours : row.value
}

// Formats the picked value for display. Uses the shared i18n key 'opportunities:cols.hoursValue'
// explicitly (via t's namespace prefix) so callers outside the 'opportunities' namespace — like
// the customer drawer tab — reuse the exact same translated string, never a local duplicate.
export function formatOpportunityValue(row: Pick<Opportunity, 'value' | 'hours'>, valueInHours: boolean, t: TFunction): string {
  const v = opportunityValueOf(row, valueInHours)
  if (v == null) return '—'
  // Euro goes through the ONE house money formatter (lib/formatters §10) — whole
  // euros for opportunity amounts, never a third hand-rolled Intl instance. The
  // 'nl-NL' locale arg is deliberate, not a leftover default: EUR is locked to
  // the domain's canonical currency locale (§5) regardless of tenant UI language
  // — see OpportunitiesTable's own comment on the same call for the full reasoning.
  return valueInHours ? t('opportunities:cols.hoursValue', { count: v }) : formatCurrency(v, 'EUR', 'nl-NL', 0)
}
