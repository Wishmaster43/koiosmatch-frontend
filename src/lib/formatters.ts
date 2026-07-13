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

// Compact form for tight spaces (donut centers, mini KPI tiles) — e.g. 99968 → "100K".
// Below `threshold` (default 10 000 = 5 digits) it falls back to the full grouped
// number so values that still fit stay exact rather than needlessly abbreviated.
export function formatNumberCompact(value: NumberInput, locale: string = 'nl-NL', threshold: number = 10_000): string {
  const n = toFiniteNumber(value)
  if (n === null) return '—'
  if (Math.abs(n) < threshold) return new Intl.NumberFormat(locale).format(n)
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

// React hook: binds both formatters to the app's active locale (see useLocale in
// datetime.ts) so components never hardcode 'nl-NL'.
export function useNumberFormat() {
  const locale = useLocale()
  return {
    locale,
    formatNumber: (value: NumberInput) => formatNumber(value, locale),
    formatNumberCompact: (value: NumberInput, threshold?: number) => formatNumberCompact(value, locale, threshold),
  }
}
