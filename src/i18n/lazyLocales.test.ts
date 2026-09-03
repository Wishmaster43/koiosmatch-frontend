/**
 * Proves the lazy-locale loader (§9 bundle discipline): a non-fallback language's
 * bundles are absent until loadLocale() is awaited, and present with real translated
 * copy afterwards — the guard against the eager-glob regression this replaces.
 */
import { describe, it, expect } from 'vitest'
import i18n, { loadLocale } from '@/i18n'

describe('lazy locale loader', () => {
  it('does not carry a non-fallback locale\'s bundles until it is loaded', () => {
    // 'pt' is never loaded anywhere else in this file/instance — proves laziness.
    expect(i18n.hasResourceBundle('pt', 'common')).toBe(false)
  })

  it('loadLocale(de) registers the bundle and resolves real German copy', async () => {
    expect(i18n.hasResourceBundle('de', 'common')).toBe(false)
    await loadLocale(i18n, 'de')
    expect(i18n.hasResourceBundle('de', 'common')).toBe(true)
    expect(i18n.t('koios.assistant.askKoios', { ns: 'common', lng: 'de' })).toBe('Im Chat abschließen')
  })
})
