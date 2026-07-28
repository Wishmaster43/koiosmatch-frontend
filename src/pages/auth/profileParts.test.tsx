/**
 * Regression (found 28-07 by an audit, not by a gate): a refactor dropped `label` from
 * the shared LANGUAGES constant while CompanySettings still did
 * `APP_LANGUAGES.map(l => l.label)`. The company-language dropdown therefore rendered
 * five EMPTY options and the saved value matched nothing — live on main, invisible to
 * both gates, because that settings file is .jsx (so tsc skips it) and had no test.
 *
 * This pins the CONTRACT of the constant rather than one screen, since every consumer
 * reads a different field of it: the profile picker uses value+flag, the company setting
 * uses label.
 */
import { describe, it, expect } from 'vitest'
import { LANGUAGES } from './profileParts'

describe('LANGUAGES — the shared language list', () => {
  it('carries the five shipped locales', () => {
    expect(LANGUAGES.map(l => l.value)).toEqual(['nl', 'en', 'de', 'fr', 'es'])
  })

  it('gives every entry a non-empty value, flag AND label', () => {
    LANGUAGES.forEach(l => {
      expect(l.value, `value of ${JSON.stringify(l)}`).toBeTruthy()
      expect(l.flag, `flag of ${l.value}`).toBeTruthy()
      expect(l.label, `label of ${l.value}`).toBeTruthy()
    })
  })

  // Endonyms on purpose: the label is STORED by the company-language setting, so it may
  // not change when the interface language changes.
  it('labels the languages in their own name', () => {
    expect(LANGUAGES.find(l => l.value === 'nl')?.label).toBe('Nederlands')
    expect(LANGUAGES.find(l => l.value === 'de')?.label).toBe('Deutsch')
  })
})
