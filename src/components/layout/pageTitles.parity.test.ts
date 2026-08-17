/**
 * Every PAGE_TITLES key must have a real translation in EVERY locale.
 *
 * The breadcrumb reads `t(activePage, { ns: 'pageTitles', defaultValue:
 * PAGE_TITLES[activePage] })`. That defaultValue is an English string, so a
 * missing key does not crash and does not render a raw key path — it renders
 * fluent English inside a Dutch UI, which reads as intentional. Measured
 * 17-08: eighteen of the fifty-nine keys had no entry in ANY locale, so every
 * report page's breadcrumb said "Reports — Applications" to a Dutch user.
 *
 * Neither existing i18n test could see it. localeParity compares the five
 * locales against EACH OTHER, and eighteen keys missing everywhere are in
 * perfect parity. keysExist only judges string LITERALS passed to t(), and
 * this key is a variable (`activePage`). Hence this third, narrow test: it
 * walks the map itself, which is the only place the full key set exists.
 */
import { describe, it, expect } from 'vitest'
import { PAGE_TITLES } from './appPages'

const LOCALES = ['nl', 'en', 'de', 'fr', 'es'] as const
const BUNDLES = import.meta.glob('/src/i18n/locales/*/pageTitles.json', { import: 'default', eager: true }) as Record<string, Record<string, string>>

// Keyed by locale code, read straight off the real locale JSON (never a mock —
// a test that stubs i18n cannot see a translation gap, see keysExist.test.ts).
const byLocale: Record<string, Record<string, string>> = {}
for (const [path, json] of Object.entries(BUNDLES)) {
  const locale = path.split('/').at(-2)!
  byLocale[locale] = json
}

describe('pageTitles ↔ PAGE_TITLES parity', () => {
  it.each(LOCALES)('%s translates every page title in the map', (locale) => {
    const bundle = byLocale[locale]
    expect(bundle, `no pageTitles.json for ${locale}`).toBeDefined()
    // Note the flat lookup: these keys carry a literal dot ('reports.flow'), and
    // the breadcrumb reads them with keySeparator: false for exactly that reason.
    const missing = Object.keys(PAGE_TITLES).filter(key => typeof bundle[key] !== 'string' || bundle[key].trim() === '')
    expect(missing, `untranslated in ${locale}: ${missing.join(', ')}`).toEqual([])
  })

})

// DELIBERATELY NOT TESTED: "a non-English locale must not equal the English
// fallback". It was written, run, and dropped — measured against the real
// bundles it flagged Dashboard, Matches, Planning, Workflows and AI Agents in
// Dutch, and every one of those is correct: they are this product's own
// vocabulary, identical in five locales by choice. A check whose output is
// mostly a list of exceptions to itself does not distinguish a defect from a
// loanword, and the next reader would maintain the exception list instead of
// the software. The missing-key check above is the one that caught something real.
