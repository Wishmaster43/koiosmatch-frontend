/**
 * numberFormat — the SIDE-EFFECT-FREE home of pure number formatters that take an
 * explicit locale (GETALLEN-1). `lib/formatters` re-exports these next to its React
 * hook, but it also imports `./datetime` and with it the i18n init; a pure helper that
 * imported `formatters` dragged that init into every consumer (DATETIME-IMPORT-LES,
 * measured again 21-10 on uploadError.ts: two suites that mock react-i18next broke at
 * module load). Rule: a helper without React imports from here, components keep using
 * `useNumberFormat()`.
 */

// A displayable numeric input: Laravel serialises DECIMAL columns as strings (§10).
export type NumberInput = number | string | null | undefined

// Coerces the input to a finite number, or null when it cannot be displayed.
export function toFiniteNumber(value: NumberInput): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

// File size in MB, locale-aware grouping, max 1 decimal — e.g. 123.45 MB → "123,5" (nl-NL).
// The caller keeps the unit string in i18n; the formatter returns the number only.
export function formatFileSizeMb(bytes: NumberInput, locale: string = 'nl-NL'): string {
  const n = toFiniteNumber(bytes)
  if (n === null) return '—'
  const mb = n / 1024 / 1024
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(mb)
}
