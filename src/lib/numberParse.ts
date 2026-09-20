/**
 * numberParse — the inverse of lib/formatters.formatNumber: reads what a user typed in
 * the ACTIVE locale ("1.250", "1.250,50", "1250,5", "1,250.50") back into a number.
 * GETALLEN-1 (Danny 09-09: "as soon as it becomes a thousand I want a . in
 * between everywhere", also inside inputs): a locale-formatted input needs a locale-aware parser,
 * never Number() on the raw string.
 */
import { localeSeparators } from '@/lib/formatters'

export { localeSeparators }

// Parses typed text to a finite number, or null when empty/unreadable. Group separators
// are dropped, the locale decimal separator becomes ".", and a lone "." or "," in a
// locale that uses the other one as decimal is still read as a decimal (a user pasting
// "1250.5" into nl gets 1250.5, not 12505).
export function parseLocaleNumber(text: string, locale: string): number | null {
  const raw = text.trim()
  if (raw === '') return null
  const { group, decimal } = localeSeparators(locale)
  let s = raw.replace(/\s/g, '')
  const hasGroup = s.includes(group)
  const hasDecimal = s.includes(decimal)
  if (hasGroup && hasDecimal) {
    s = s.split(group).join('').replace(decimal, '.')
  } else if (hasDecimal) {
    // Only the locale decimal present: a single occurrence is a decimal; several are groups.
    s = s.split(decimal).length > 2 ? s.split(decimal).join('') : s.replace(decimal, '.')
  } else if (hasGroup) {
    // Only the locale group separator present: "1.250" is a group in nl, but "1250.5"
    // (one separator with fewer than three trailing digits) reads as a decimal.
    const pieces = s.split(group)
    const looksGrouped = pieces.slice(1).every(p => p.length === 3)
    s = looksGrouped ? pieces.join('') : pieces.join('.')
  }
  s = s.replace(/[^0-9.-]/g, '')
  if (s === '' || s === '-' || s === '.') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
