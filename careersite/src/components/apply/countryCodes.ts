// Dependency-free EU dial-code data for the phone country picker (formulier-v2).
// This is reference DATA, not user-facing copy — flag emoji and dial codes are
// language-neutral, so (unlike component copy) they do not go through strings.ts.
export interface CountryCode {
  code: string
  dial: string
  flag: string
}

// ~12 common EU countries, NL first/default per the reference form spec.
export const COUNTRY_CODES: CountryCode[] = [
  { code: 'NL', dial: '31', flag: '🇳🇱' },
  { code: 'BE', dial: '32', flag: '🇧🇪' },
  { code: 'DE', dial: '49', flag: '🇩🇪' },
  { code: 'FR', dial: '33', flag: '🇫🇷' },
  { code: 'GB', dial: '44', flag: '🇬🇧' },
  { code: 'ES', dial: '34', flag: '🇪🇸' },
  { code: 'IT', dial: '39', flag: '🇮🇹' },
  { code: 'PL', dial: '48', flag: '🇵🇱' },
  { code: 'PT', dial: '351', flag: '🇵🇹' },
  { code: 'IE', dial: '353', flag: '🇮🇪' },
  { code: 'AT', dial: '43', flag: '🇦🇹' },
  { code: 'LU', dial: '352', flag: '🇱🇺' },
]

export const DEFAULT_COUNTRY_CODE = 'NL'

// Looks up the dial code for a selected ISO alpha-2 code — falls back to the
// default country so an unrecognised/stale value never produces an empty dial.
export function dialCodeFor(code: string): string {
  return COUNTRY_CODES.find((c) => c.code === code)?.dial ?? COUNTRY_CODES[0].dial
}
