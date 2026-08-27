/**
 * formatters — locale-aware NUMBER formatting tied to the active language.
 *
 * Mirrors datetime.ts: dashboards, KPI cards, donuts and pagination footers all
 * render raw backend integers (e.g. 99968) — this is the ONE place that turns
 * them into "99.968" (nl-NL) instead of every screen hand-rolling its own
 * `.toLocaleString('nl-NL')` (that hardcode is exactly the bug this file fixes —
 * a German tenant must see German grouping, not Dutch).
 */
import { useLocale } from './datetime'

type NumberInput = number | string | null | undefined

// Coerces the input to a finite number, or null when it can't be displayed.
function toFiniteNumber(value: NumberInput): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

// Full grouped number with the locale's thousands separator — e.g. 99968 → "99.968"
// (nl-NL) / "99,968" (en-GB). Non-React call sites pass an explicit locale; React
// components should prefer the useNumberFormat() hook below so they never hardcode one.
export function formatNumber(value: NumberInput, locale: string = 'nl-NL'): string {
  const n = toFiniteNumber(value)
  return n === null ? '—' : new Intl.NumberFormat(locale).format(n)
}

/**
 * Percentages, the ONE house way (FMT-PROCENT-1, Danny 14-08: a matches KPI read
 * "5,882%" where it meant 5,9%).
 *
 * The reports had grown five different treatments of the same thing: plain
 * `formatNumber(x) + '%'` (which lets Intl print three decimals),
 * `Math.round(x * 100)` (whole numbers, but bypassing the locale entirely) and a
 * bare template literal. Two helpers replace all of them, named after the UNIT
 * they take so a call site cannot silently be off by a factor of a hundred:
 *   formatPercent(5.882)  → "5,9%"   — the value is already a percentage
 *   formatRatio(0.05882)  → "5,9%"   — the value is a fraction of one
 * At most one decimal, and a whole number stays whole ("50%", never "50,0%").
 * Null/undefined/non-finite render the house dash, never a fabricated 0%.
 *
 * NEVER APPLY EITHER OF THESE TO A `*_rate` FIELD BY NAME (RATE-EENHEID-1, backend
 * contract). Three of the API's `_rate` fields are MONEY, not ratios:
 *   purchase_rate · sale_rate · sell_rate  = euro per hour, decimal(10,2).
 * A € 45,00 hourly rate run through here renders as "45%" (or "4500%" on the ratio
 * helper) on a screen showing real money. Those three go through formatCurrency.
 * The backend contract lists the unit of every rate field; check it, do not guess:
 *   percentage 0-100 : win_rate · success_rate · done_rate
 *   fraction 0-1     : conversion_rate · reach_rate · fill_rate · match_rate
 *   money            : purchase_rate · sale_rate · sell_rate
 * Any ratio field may be null when its denominator is 0 — that means "nothing
 * measured yet" and must stay a dash, which is exactly what these return.
 */
export function formatPercent(value: NumberInput, locale: string = 'nl-NL'): string {
  const n = toFiniteNumber(value)
  if (n === null) return '—'
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n)}%`
}

// A 0-1 ratio rendered as a percentage; null (nothing measured yet, zero denominator) stays a dash.
export function formatRatio(value: NumberInput, locale: string = 'nl-NL'): string {
  const n = toFiniteNumber(value)
  return n === null ? '—' : formatPercent(n * 100, locale)
}

// Compact form for tight spaces (donut centers, mini KPI tiles) — e.g. 99968 → "100K".
// Below `threshold` (default 10 000 = 5 digits) it falls back to the full grouped
// number so values that still fit stay exact rather than needlessly abbreviated.
export function formatNumberCompact(value: NumberInput, locale: string = 'nl-NL', threshold: number = 10_000): string {
  const n = toFiniteNumber(value)
  if (n === null) return '—'
  if (Math.abs(n) < threshold) return new Intl.NumberFormat(locale).format(n)
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

// Locale-aware currency — e.g. 5.12 → "€ 5,12" (nl-NL) / "€5.12" (en-GB). The ONE
// place billing screens format money (K0 billing block) so they never hand-roll
// their own `new Intl.NumberFormat(locale, { style: 'currency', ... })` call.
// Defaults to EUR since every backend money field falls back to it (mirrors
// KoiosPricingCard/BillingUsageSettings' prior inline helpers).
// `maximumFractionDigits` caps decimals for whole-amount screens (opportunities
// show "€ 17.000", not "€ 17.000,00"); omitted = the locale's own default.
// `minimumFractionDigits` (CREDITS-1) lets a sub-cent price render UNROUNDED as
// delivered — e.g. a credit_price of 0.005 needs min 2/max 4 so Intl doesn't clip
// it back down to "€ 0,01"; never round such a value client-side before calling this.
export function formatCurrency(
  value: NumberInput, currency: string = 'EUR', locale: string = 'nl-NL',
  maximumFractionDigits?: number, minimumFractionDigits?: number,
): string {
  const n = toFiniteNumber(value)
  return n === null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits, minimumFractionDigits }).format(n)
}

// React hook: binds all three formatters to the app's active locale (see useLocale
// in datetime.ts) so components never hardcode 'nl-NL'.
export function useNumberFormat() {
  const locale = useLocale()
  return {
    locale,
    formatNumber: (value: NumberInput) => formatNumber(value, locale),
    formatNumberCompact: (value: NumberInput, threshold?: number) => formatNumberCompact(value, locale, threshold),
    formatPercent: (value: NumberInput) => formatPercent(value, locale),
    formatRatio: (value: NumberInput) => formatRatio(value, locale),
    formatCurrency: (value: NumberInput, currency?: string, maximumFractionDigits?: number, minimumFractionDigits?: number) =>
      formatCurrency(value, currency, locale, maximumFractionDigits, minimumFractionDigits),
  }
}
