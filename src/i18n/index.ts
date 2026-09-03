/**
 * i18n — translation runtime.
 *
 * Structure: one folder per language under `locales/`, one JSON per domain
 * (namespace) inside it — e.g. locales/nl/candidates.json. Files are auto-collected
 * with Vite's import.meta.glob, so adding a language or a page's translation file
 * needs NO change here: just drop the JSON in the right folder.
 *
 * Only the FALLBACK locale (nl) ships eagerly in this module's own chunk — every
 * other language loads lazily on demand via lazyLocales.ts (§9 bundle discipline;
 * this used to glob all seven locales eager, inlining ~4.2 MB of JSON into one
 * 3209 KB chunk that sat on the critical path of every page).
 *
 * The active language lives in ThemeContext (persisted as `km-language`); its
 * setLanguage() awaits loadLocale() before calling i18n.changeLanguage() so no
 * key ever flashes untranslated while the async import resolves.
 */
import i18n from 'i18next'
import type { Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { loadLocale, lazyLocaleBackend, ALL_NAMESPACES } from './lazyLocales'

const FALLBACK_LNG = 'nl'

// Eager glob for the fallback locale ONLY — this is the piece that must stay
// synchronously available (nl is what every t() falls back to on a missing key).
const fallbackModules = import.meta.glob('./locales/nl/*.json', { eager: true })

const resources: Resource = { [FALLBACK_LNG]: {} }
for (const path in fallbackModules) {
  const ns = path.match(/\.\/locales\/nl\/([^/]+)\.json$/)?.[1]
  if (!ns) continue
  resources[FALLBACK_LNG][ns] = (fallbackModules[path] as { default: unknown }).default as Resource[string][string]
}

// The persisted language choice; falls back to nl when unset or unrecognised.
const initialLng = localStorage.getItem('km-language') || FALLBACK_LNG

// The backend serves every non-nl bundle on demand; partialBundledLanguages keeps the
// eager nl resources authoritative so the backend is never asked for them.
const initPromise = i18n.use(lazyLocaleBackend).use(initReactI18next).init({
  resources,
  partialBundledLanguages: true,
  lng: initialLng,
  fallbackLng: FALLBACK_LNG,
  ns: ALL_NAMESPACES,
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes — prevents double-encoding
  returnEmptyString: false,
})

// Resolves once the persisted language's bundles are in (init awaits the backend), so
// main.tsx can hold the first render until no key would flash untranslated.
export const ready: Promise<void> = initPromise.then(() => undefined, () => undefined)

// TAAL-LANG-1 (Danny 06-08): index.html hardcodes lang="en", so the browser
// spellchecked every Dutch tenant as English. The document language must follow
// the app language — on boot AND on every runtime switch.
document.documentElement.lang = i18n.language
i18n.on('languageChanged', lng => { document.documentElement.lang = lng })

export default i18n
export { loadLocale }

/** Maps the app's language code to a BCP-47 locale for Intl date/number formatting. */
export const LOCALE_BY_LANG: Record<string, string> = { nl: 'nl-NL', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-PT' } // pt-PT: European Portuguese (Danny 02-09)
