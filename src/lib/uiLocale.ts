// The UI language as a bare 2-letter code ("en", "nl"), read from <html lang>, which
// src/i18n keeps in sync on every language change. Reading the DOM instead of importing
// i18n keeps this helper side-effect free (DATETIME-IMPORT-LES: an i18n import drags the
// init chain into every consumer). Returns undefined outside a browser or before init.
export function uiLocale(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const lang = (document.documentElement.lang || '').trim().toLowerCase()
  const base = lang.split(/[-_]/)[0]
  return base || undefined
}
