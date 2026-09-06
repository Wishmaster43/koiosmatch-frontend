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
export function formatOpportunityValue(
  row: Pick<Opportunity, 'value' | 'hours'>, valueInHours: boolean, t: TFunction,
  // I18N-1 L5: money renders in the TENANT's currency and the app locale; callers
  // pass both from useNumberFormat() (the defaults keep a bare call rendering EUR).
  currency: string = 'EUR', locale: string = 'nl-NL',
): string {
  const v = opportunityValueOf(row, valueInHours)
  if (v == null) return '—'
  // Money goes through the ONE house money formatter (lib/formatters §10) — whole
  // amounts for opportunity values, never a third hand-rolled Intl instance.
  return valueInHours ? t('opportunities:cols.hoursValue', { count: v }) : formatCurrency(v, currency, locale, 0)
}
