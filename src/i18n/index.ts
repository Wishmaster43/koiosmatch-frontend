/**
 * i18n — translation runtime.
 *
 * Structure: one folder per language under `locales/`, one JSON per domain
 * (namespace) inside it — e.g. locales/nl/candidates.json. Files are auto-collected
 * with Vite's import.meta.glob, so adding a language or a page's translation file
 * needs NO change here: just drop the JSON in the right folder.
 *
 * The active language lives in ThemeContext (persisted as `km-language`); its
 * setLanguage() calls i18n.changeLanguage() to switch at runtime.
 */
import i18n from 'i18next'
import type { Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'

const modules = import.meta.glob('./locales/*/*.json', { eager: true })

const resources: Resource = {}
const namespaces = new Set<string>()
for (const path in modules) {
  const match = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/)
  if (!match) continue
  const [, lng, ns] = match
  resources[lng] ??= {}
  resources[lng][ns] = (modules[path] as { default: unknown }).default as Resource[string][string]
  namespaces.add(ns)
}

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem('km-language') || 'nl',
  fallbackLng: 'nl',
  ns: [...namespaces],
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes — prevents double-encoding
  returnEmptyString: false,
})

export default i18n

/** Maps the app's language code to a BCP-47 locale for Intl date/number formatting. */
export const LOCALE_BY_LANG: Record<string, string> = { nl: 'nl-NL', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES' }
