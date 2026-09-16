/**
 * Shared opportunity "value" cell logic — picks the value per the row's deal type
 * unit (euro/hours/quote) and formats it. Per-row unit replaced the tenant-wide
 * `opportunity_value_in_hours` setting (X-5-UNIT-PER-ROW, bundle B2-2).
 */
import type { TFunction } from 'i18next'
import type { Opportunity } from '@/types/opportunity'
import { formatCurrency, formatNumber } from '@/lib/formatters'

// Picks the raw numeric value (hours or euro) a row should sort/display by,
// based on its own deal type unit (null/euro/hours/quote).
export function opportunityValueOf(row: Pick<Opportunity, 'value' | 'hours' | 'dealTypeUnit'>): number | null | undefined {
  // Untyped deals (dealTypeUnit=null) count as euro; hours-typed show hours; quotes have no numeric value.
  if (row.dealTypeUnit === 'hours') return row.hours
  if (row.dealTypeUnit === 'quote') return null
  return row.value // euro, default for untyped
}

// Formats the picked value for display. Uses the shared i18n key 'opportunities:cols.hoursValue'
// explicitly (via t's namespace prefix) so callers outside the 'opportunities' namespace — like
// the customer drawer tab — reuse the exact same translated string, never a local duplicate.
export function formatOpportunityValue(
  row: Pick<Opportunity, 'value' | 'hours' | 'dealTypeUnit'>, t: TFunction,
  // I18N-1 L5: money renders in the TENANT's currency and the app locale; callers
  // pass both from useNumberFormat() (the defaults keep a bare call rendering EUR).
  currency: string = 'EUR', locale: string = 'nl-NL',
): string {
  const v = opportunityValueOf(row)
  if (v == null) return '—'
  // Money and hours both go through the house number formatters (GETALLEN-1) —
  // the hours branch pre-formats the number (thousands separator) before it
  // reaches the i18n string, since i18next itself never formats {{count}}.
  return row.dealTypeUnit === 'hours'
    ? t('opportunities:cols.hoursValue', { count: v, value: formatNumber(v, locale) })
    : formatCurrency(v, currency, locale, 0)
}
