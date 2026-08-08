/**
 * phoneNumber — ONE canonical form for a typed phone number, so the same number
 * written three ways ('+31612345678', '0612345678', '06-12345678') is one string.
 *
 * Why this exists (DUP-PHONE-1, measured against the live API 2026-08-08): the
 * backend duplicate guard (App\Services\Candidate\DuplicateFinder) compares the
 * RAW column value — `where('mobile', $value)`. So
 * `GET /candidates/check-duplicate?mobile=%2B31665277265` answers exists:true while
 * `?mobile=0665277265` answers exists:false for the very same candidate. Without a
 * canonical form at the save boundary, "the same mobile in another notation" walks
 * straight past the guard and a second dossier is born — the exact cost Danny's
 * duplicate check is meant to prevent.
 *
 * Deliberately conservative: it NEVER guesses a country. A value without a leading
 * `+` and without a leading `0` (e.g. '31612345678') stays exactly as typed, because
 * that could be a foreign local number just as easily as a Dutch one.
 *
 * Related but different: `lib/waDigits` produces bare digits for a wa.me deep link
 * (no `+`, empty for junk). This helper is about identity/storage, not links —
 * keep both, they answer different questions.
 */

// The tenant market is NL; a bare national number ('06…', '030…') is Dutch.
const DEFAULT_COUNTRY_CODE = '31'

// Below this many digits nothing is a real MSISDN — such a value is left untouched
// rather than "canonicalised" into a number the user never typed.
const MIN_MSISDN_DIGITS = 8

/**
 * Canonical E.164-style form of a typed number, or the trimmed input when the
 * value carries too little information to canonicalise it safely.
 */
export function canonicalPhone(raw: string | null | undefined, countryCode: string = DEFAULT_COUNTRY_CODE): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return ''

  // '+31 (0)6 12345678' is the standard Dutch way of writing a trunk zero that must
  // be DROPPED once the country code is there — strip that exact group before the
  // digits are read, or it becomes a bogus '+310…'. '(030) 12 34 567' is untouched.
  const withoutParenthesisedTrunk = trimmed.replace(/\(0\)/g, '')

  // Separators carry no meaning: spaces, dashes, dots, slashes and parentheses go.
  // The leading `+` is the only non-digit that survives, as an explicit signal.
  const hasPlus = trimmed.startsWith('+')
  const digits = withoutParenthesisedTrunk.replace(/\D/g, '')
  if (digits.length < MIN_MSISDN_DIGITS) return trimmed

  // Already international: '+31 (0)6 12 34 56 78' -> '+31612345678'.
  if (hasPlus) return `+${digits}`
  // International access code written out: '0031612345678' -> '+31612345678'.
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  // National notation: '0612345678' / '06-12345678' -> '+31612345678'.
  if (digits.startsWith('0')) return `+${countryCode}${digits.slice(1)}`
  // Ambiguous (no +, no trunk 0): never invent a country code — keep what was typed.
  return trimmed
}

/**
 * Do two typed numbers denote the same line? Blank never matches blank — an empty
 * field is "unknown", not "equal to every other empty field".
 */
export function samePhone(a: string | null | undefined, b: string | null | undefined, countryCode: string = DEFAULT_COUNTRY_CODE): boolean {
  const left = canonicalPhone(a, countryCode)
  const right = canonicalPhone(b, countryCode)
  return left !== '' && left === right
}

/**
 * Do two typed e-mail addresses denote the same mailbox? Case-insensitive, mirroring
 * the server: the `candidates.email` column is a case-insensitive MySQL collation, so
 * 'Piet@Example.test' and 'piet@example.test' collide there too (measured 2026-08-08).
 */
export function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? '').trim().toLowerCase()
  const right = (b ?? '').trim().toLowerCase()
  return left !== '' && left === right
}
