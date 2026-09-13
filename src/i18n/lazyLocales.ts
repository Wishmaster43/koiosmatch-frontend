/**
 * Lazy locale loader (§9 bundle discipline). src/i18n/index.ts bundles only the
 * fallback locale (nl) eagerly; every other language's JSON is fetched via a
 * dynamic import ONLY when that language is actually selected, so seven
 * locales' worth of translation JSON no longer rides on every page's
 * critical-path chunk (measured: 3209 KB minified before this change).
 */
import type { i18n as I18n, BackendModule, ReadCallback } from 'i18next'

// Non-eager glob: the KEYS (file paths) are resolved statically at build time so
// namespace/language lists are known up front, but each VALUE is a dynamic
// import() invoked only when actually called — this is what keeps non-fallback
// locales out of the eager bundle.
const localeModules = import.meta.glob('./locales/*/*.json') as Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
>

// Extracts the locale/namespace segments from a glob path like './locales/de/common.json'.
const PATH_RE = /^\.\/locales\/([^/]+)\/([^/]+)\.json$/

// Every namespace shipped by the app, derived from the (statically known) glob keys —
// needed so i18next's `ns` list is complete even before a language's JSON is fetched.
export const ALL_NAMESPACES = [...new Set(
  Object.keys(localeModules).map(p => p.match(PATH_RE)?.[2]).filter((n): n is string => !!n),
)]

/**
 * Explicit preload of one language (tests, eager warm-ups): delegates to i18next's own
 * loadLanguages(), which goes through the backend above and resolves once every
 * namespace is registered. A no-op for a language that is already loaded.
 */
export function loadLocale(instance: I18n, lng: string): Promise<void> {
  if (instance.hasResourceBundle(lng, 'common')) return Promise.resolve()
  return new Promise((resolve, reject) => instance.loadLanguages(lng, err => (err ? reject(err) : resolve())))
}

// Importer for one language/namespace pair, or undefined when no such file exists.
function importerFor(lng: string, ns: string) {
  return localeModules[`./locales/${lng}/${ns}.json`]
}

/**
 * i18next backend that serves every non-bundled locale through the dynamic-import
 * glob above. With `partialBundledLanguages: true` i18next only asks the backend for
 * bundles that are NOT already in `resources` (the eager fallback), so init() with a
 * persisted non-nl language and every later changeLanguage() await the real JSON
 * before `languageChanged` fires — no caller has to remember to preload anything.
 */
export const lazyLocaleBackend: BackendModule = {
  type: 'backend',
  init() { /* nothing to configure: the glob is resolved at build time */ },
  read(lng: string, ns: string, callback: ReadCallback) {
    const importer = importerFor(lng, ns)
    if (!importer) { callback(null, {}); return }
    importer().then(mod => callback(null, mod.default)).catch(err => callback(err as Error, null))
  },
}
