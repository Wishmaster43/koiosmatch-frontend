/**
 * countries — ISO-3166-1 alpha-2 country codes (COUNTRY-1) for the candidate's
 * home-address "Land" field. The CODE list is DATA (the fixed ISO standard, not a
 * tenant lookup — mirrors NL_PROVINCES in candidates/drawer/constants.ts, which is
 * "a fixed real-world list, not tenant-configurable"). Display NAMES are never
 * hardcoded: `Intl.DisplayNames` resolves each code to the current UI language at
 * render time, so every locale (nl/en/de/fr/es) gets its own country names for
 * free with zero translation keys. The candidate stores the ISO-2 CODE (not the
 * localized name) so the label can always be re-resolved per viewer language.
 *
 * Deliberately does NOT import `@/i18n` (its `LOCALE_BY_LANG` map): that module
 * self-initialises the real i18next instance as a side effect on import, which
 * would leak real translations into test files that assume i18n stays
 * uninitialised (raw `t()` keys — see AddCandidateModal.test.tsx's own note).
 * The bare app language code (nl/en/de/fr/es) is itself a valid BCP-47 primary
 * language subtag, so it works directly with `Intl.DisplayNames`/`localeCompare`
 * without needing a region suffix.
 */

// Officially assigned ISO-3166-1 alpha-2 codes (sovereign states + dependent
// territories). Codes only — no names — so nothing here needs translation.
export const COUNTRY_CODES: string[] = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ',
  'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ',
  'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ',
  'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET',
  'FI', 'FJ', 'FK', 'FM', 'FO', 'FR',
  'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY',
  'HK', 'HM', 'HN', 'HR', 'HT', 'HU',
  'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT',
  'JE', 'JM', 'JO', 'JP',
  'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ',
  'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY',
  'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
  'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ',
  'OM',
  'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY',
  'QA',
  'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ',
  'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ',
  'UA', 'UG', 'UM', 'US', 'UY', 'UZ',
  'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU',
  'WF', 'WS',
  'YE', 'YT',
  'ZA', 'ZM', 'ZW',
]

// NL/BE/DE surface first — Koios Match's home market — the rest sorts alphabetically.
const PRIORITY_CODES = ['NL', 'BE', 'DE']

// Resolve one ISO-2 code to its display name in the given app language. Falls back
// to the bare code if Intl.DisplayNames can't resolve it (unknown code, old browser).
export function getCountryName(code: string, lang: string): string {
  if (!code) return ''
  try {
    const dn = new Intl.DisplayNames([lang], { type: 'region' })
    return dn.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

// The full {value,label} option list for a searchable country dropdown, localized
// to `lang` and ordered NL/BE/DE first, then alphabetically by display name.
export function getCountryOptions(lang: string): Array<{ value: string; label: string }> {
  const all = COUNTRY_CODES.map(code => ({ value: code, label: getCountryName(code, lang) }))
  const priority = PRIORITY_CODES
    .map(code => all.find(o => o.value === code))
    .filter((o): o is { value: string; label: string } => !!o)
  const rest = all
    .filter(o => !PRIORITY_CODES.includes(o.value))
    .sort((a, b) => a.label.localeCompare(b.label, lang))
  return [...priority, ...rest]
}
