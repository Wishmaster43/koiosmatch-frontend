/**
 * postcode — country-aware postcode EXAMPLES for form placeholders (X-I18N-3,
 * I18N-COMPLEET-1). The app never blocks a save on postcode shape (the backend
 * validates per country); this helper only makes the placeholder honest for the
 * country the user picked, instead of the Dutch "1234 AB" everywhere.
 */
import type { TFunction } from 'i18next'

// One market example per ISO-2 country the product ships in; the locale's own
// common:placeholders.postcodeExample stays the fallback for every other country.
const EXAMPLES: Record<string, string> = {
  NL: '1234 AB', BE: '1000', DE: '10115', FR: '75001', ES: '28001', IT: '20121', PT: '1000-001', GB: 'SW1A 1AA', UK: 'SW1A 1AA',
  LU: 'L-1009', AT: '1010', CH: '8001', IE: 'D02 X285', DK: '1050', SE: '111 22', NO: '0150', PL: '00-001',
}

// Placeholder for the postcode field of an address whose country is `countryCode`
// (ISO-2, case-insensitive; a name or empty value falls back to the locale example).
export function postcodePlaceholder(countryCode: string | null | undefined, t: TFunction): string {
  const code = (countryCode ?? '').trim().toUpperCase()
  return EXAMPLES[code] ?? t('common:placeholders.postcodeExample')
}
