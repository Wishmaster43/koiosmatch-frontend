/**
 * companyIdentifiers — the ONE source of truth for "is this Chamber-of-Commerce
 * number / VAT number shaped correctly?", per COUNTRY (Danny 2026-08-08, points
 * 10 + 11: "KVK nummer check is 8 cijfers --> Check per land want BE, DE, FR is
 * anders" and "BTW nummer voor NL begint met NL, moeten check instellen per
 * klant --> Instellingen").
 *
 * MEASURED before writing (dev API, tenant `yesway`, 2026-08-08):
 *  - `PATCH /candidates/{id}` with `freelance.kvk_number = "0123456789"` →
 *    422 "The freelance.kvk number field must be 8 digits"; with
 *    `freelance.vat_number = "BE0123456789"` → 422 "format is invalid". So the
 *    BACKEND still hard-codes the Dutch shape for the ZZP profile — a Belgian /
 *    German / French freelancer genuinely CANNOT be saved today. That is a
 *    backend gap, reported upward; this module fixes the frontend half and the
 *    ZZP tab warns honestly rather than pretending the save will land.
 *  - `PATCH /customers/{id}` and the location routes accept ANY string
 *    (`nullable|string|max:32..64`), so for customers/locations the frontend is
 *    the only place a format check can live at all.
 *  - `customer.country` / `customer_location.country` come back as ISO-2 ("NL"),
 *    which is what `resolveCountryCode` prefers; a few older create forms still
 *    hand a NAME ("Nederland"), so names are resolved too (never guessed).
 *
 * Pure module on purpose: no i18n, no React, no API. Callers turn a result into
 * a message (`useIdentifierValidation`) so this file stays unit-testable and can
 * be reused by any screen that collects a KvK/BTW number.
 */

/** Which identifier is being checked — the two the product collects today. */
export type IdentifierKind = 'coc' | 'vat'

/** Outcome of one check. `unverifiable` = we could not resolve a rule, never a failure. */
export type IdentifierStatus = 'empty' | 'valid' | 'invalid' | 'unverifiable'

/** Tenant behaviour on a mismatch — the `company_identifier_validation` setting. */
export type IdentifierValidationMode = 'warn' | 'block'

/** Settings key holding the mode (generic key/value store, POST /settings). */
export const IDENTIFIER_VALIDATION_SETTING = 'company_identifier_validation'

/**
 * Default mode. WARN, not block: the per-country rules below are format
 * heuristics, not a register lookup — a German Handelsregisternummer in
 * particular has real-world variants we cannot enumerate — so the safe default
 * tells the user without ever refusing a number that may well be correct (§3,
 * "never hold back data that can be valid"). A tenant that wants a hard gate
 * flips it in Settings → Klanten → Nummervalidatie.
 */
export const DEFAULT_IDENTIFIER_VALIDATION_MODE: IdentifierValidationMode = 'warn'

export interface IdentifierResult {
  status: IdentifierStatus
  /** ISO-2 the rule was resolved for; null when no rule could be resolved. */
  countryCode: string | null
  /** Example of the expected shape — DATA (a real-world format), never a translated label. */
  example: string | null
}

interface CountryRules {
  coc: { pattern: RegExp; example: string }
  vat: { pattern: RegExp; example: string }
}

/**
 * Per-country rules. Patterns run against the NORMALISED value (upper-case, no
 * spaces/dots/dashes/slashes), so a user may type "NL 8633 4117 2 B01".
 *
 * NL — KvK number is exactly 8 digits; VAT is NL + 9 digits + B + 2 digits.
 * BE — ondernemingsnummer (KBO/BCE) is 10 digits starting 0 or 1; VAT is BE0 + 9 digits.
 * DE — Handelsregisternummer is a register token (HRA/HRB/GnR/PR/VR/GsR) + up to
 *      6 digits + an optional court suffix; VAT (USt-IdNr.) is DE + 9 digits.
 * FR — company number is SIREN (9 digits) or SIRET (14 digits); VAT is FR + a
 *      2-character key + the 9-digit SIREN.
 */
const COUNTRY_RULES: Record<string, CountryRules> = {
  NL: {
    coc: { pattern: /^\d{8}$/, example: '12345678' },
    vat: { pattern: /^NL\d{9}B\d{2}$/, example: 'NL123456789B01' },
  },
  BE: {
    coc: { pattern: /^[01]\d{9}$/, example: '0123456789' },
    vat: { pattern: /^BE0\d{9}$/, example: 'BE0123456789' },
  },
  DE: {
    coc: { pattern: /^(HRA|HRB|GNR|GSR|PR|VR)\d{1,6}[A-Z]{0,3}$/, example: 'HRB 12345' },
    vat: { pattern: /^DE\d{9}$/, example: 'DE123456789' },
  },
  FR: {
    coc: { pattern: /^(\d{9}|\d{14})$/, example: '123456789' },
    vat: { pattern: /^FR[A-Z0-9]{2}\d{9}$/, example: 'FR12123456789' },
  },
}

/** Countries this module can actually check — anything else stays unverifiable. */
export const SUPPORTED_IDENTIFIER_COUNTRIES: string[] = Object.keys(COUNTRY_RULES)

/**
 * Country NAMES that must map onto a supported code. Only the five shipped UI
 * languages for the four supported countries: this is lookup DATA, not
 * user-facing text, and it stays small on purpose — an unresolved name yields
 * `unverifiable` (a soft hint), never a wrong rule.
 */
const COUNTRY_NAME_ALIASES: Record<string, string> = {
  nederland: 'NL', netherlands: 'NL', niederlande: 'NL', 'pays-bas': 'NL',
  'paisesbajos': 'NL', 'paísesbajos': 'NL', holland: 'NL',
  belgie: 'BE', 'belgië': 'BE', belgium: 'BE', belgien: 'BE', belgique: 'BE',
  belgica: 'BE', 'bélgica': 'BE',
  duitsland: 'DE', germany: 'DE', deutschland: 'DE', allemagne: 'DE', alemania: 'DE',
  frankrijk: 'FR', france: 'FR', frankreich: 'FR', francia: 'FR',
}

/**
 * Resolve whatever a record stores in its country field to an ISO-2 code:
 * an ISO-2 code passes straight through, a known country NAME is mapped, and
 * anything else returns null so the caller degrades to a soft hint.
 */
export function resolveCountryCode(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return null
  const upper = raw.toUpperCase()
  if (/^[A-Z]{2}$/.test(upper)) return upper
  const key = raw.toLowerCase().replace(/[\s.]+/g, '')
  return COUNTRY_NAME_ALIASES[key] ?? null
}

/** Strip the separators people type (spaces, dots, dashes, slashes) and upper-case. */
export function normalizeIdentifier(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[\s.\-/]+/g, '')
}

/**
 * VAT numbers are self-describing: they carry their own country prefix. When the
 * record has no usable country we still honour that prefix, so "BE0123456789" on
 * a country-less customer is checked against the Belgian rule instead of being
 * waved through as unverifiable.
 */
function countryFromVatPrefix(normalized: string): string | null {
  const prefix = normalized.slice(0, 2)
  return COUNTRY_RULES[prefix] ? prefix : null
}

/**
 * Check one identifier against the rule of the given country. Blank is never a
 * format error (required-ness is a separate axis, §3), and a country we have no
 * rule for yields `unverifiable` — the caller shows a hint, never a block.
 */
export function checkIdentifier(
  kind: IdentifierKind,
  value: string | null | undefined,
  country: string | null | undefined,
): IdentifierResult {
  const normalized = normalizeIdentifier(value)
  if (!normalized) return { status: 'empty', countryCode: resolveCountryCode(country), example: null }

  const code = resolveCountryCode(country)
    ?? (kind === 'vat' ? countryFromVatPrefix(normalized) : null)
  const rules = code ? COUNTRY_RULES[code] : undefined
  if (!rules) return { status: 'unverifiable', countryCode: code, example: null }

  const rule = rules[kind]
  return {
    status: rule.pattern.test(normalized) ? 'valid' : 'invalid',
    countryCode: code,
    example: rule.example,
  }
}

/**
 * Turn a result into how hard the UI should push back. `unverifiable` always
 * stays a warning — we could not check it, so we may not block it; only a real
 * mismatch escalates to an error, and only when the tenant asked for that.
 */
export function identifierSeverity(
  result: IdentifierResult,
  mode: IdentifierValidationMode,
): 'error' | 'warning' | null {
  if (result.status === 'empty' || result.status === 'valid') return null
  if (result.status === 'unverifiable') return 'warning'
  return mode === 'block' ? 'error' : 'warning'
}

/** Read the tenant setting tolerantly — anything but the literal 'block' falls back to the default. */
export function parseIdentifierValidationMode(raw: unknown): IdentifierValidationMode {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'block') return 'block'
  if (value === 'warn') return 'warn'
  return DEFAULT_IDENTIFIER_VALIDATION_MODE
}

/** The example format for one country+kind — used by the Settings screen's rules table. */
export function identifierExample(kind: IdentifierKind, countryCode: string): string | null {
  return COUNTRY_RULES[countryCode]?.[kind].example ?? null
}
