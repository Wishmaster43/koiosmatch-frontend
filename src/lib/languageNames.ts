// Language names come from the PLATFORM (ICU `Intl.DisplayNames`) in the user's
// own UI language, so a language a user adds in the workflow module never needs
// its own i18n key — the browser/Node ICU data already knows every name.
export function languageDisplayName(code: string, uiLocale: string): string {
  try {
    const names = new Intl.DisplayNames([uiLocale], { type: 'language', fallback: 'code' })
    return names.of(code) ?? code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

// Curated ISO 639-1 codes a user may add on top of the seven MESSAGING_LANGUAGES
// defaults, plus 'pap' (Papiaments, ISO 639-2) for the Dutch-Caribbean market.
export const ADDABLE_LANGUAGE_CODES = [
  'ar', 'bg', 'bs', 'cs', 'da', 'el', 'et', 'fa', 'fi', 'he', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'ko',
  'lt', 'lv', 'mk', 'ms', 'no', 'pap', 'pt', 'ru', 'sk', 'sl', 'sq', 'sr', 'sv', 'sw', 'th', 'tl', 'tr',
  'uk', 'ur', 'vi', 'zh',
] as const
