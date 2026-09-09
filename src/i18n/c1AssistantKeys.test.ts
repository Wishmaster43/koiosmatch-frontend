/**
 * C1 key-resolution pin (SCHERMWAARHEID-1): the assistant + learning surfaces'
 * component tests run a key-echoing i18n stub, so THIS test proves against the
 * REAL i18n init that the keys resolve to shipped copy — a missing key would
 * echo itself here and fail loudly instead of shipping raw keys to the screen.
 *
 * en/de/fr load lazily (§9 bundle discipline — only nl ships eagerly), so this
 * loads them once up front via the real loader before asserting against them.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import i18n, { loadLocale } from '@/i18n'

beforeAll(() => Promise.all([loadLocale(i18n, 'en'), loadLocale(i18n, 'de'), loadLocale(i18n, 'fr')]))

describe('C1 assistant/learning i18n keys resolve', () => {
  it('resolves the assistant block keys from the common namespace', () => {
    expect(i18n.t('koios.assistant.title', { ns: 'common', lng: 'nl' })).toBe('Koios stelt voor')
    expect(i18n.t('koios.assistant.emptyState', { ns: 'common', lng: 'en' })).toBe('Nothing needs your attention right now.')
    // Danny 09-09: the chat-handoff intent carries the REASON (the suggestion body), so
    // Koios knows why — the record itself rides along as a context chip.
    expect(i18n.t('koios.assistant.askIntent', { ns: 'common', lng: 'nl', body: 'Bel Ahmed: 90 dagen geen contact.' })).toBe('Bel Ahmed: 90 dagen geen contact. Wat stel je voor?')
    expect(i18n.t('koios.assistant.askKoios', { ns: 'common', lng: 'de' })).toBe('Im Chat abschließen')
  })

  it('resolves the learning card + tab keys from the koios namespace', () => {
    expect(i18n.t('learning.topQuestions', { ns: 'koios', lng: 'nl' })).toBe('Meest gestelde vragen')
    expect(i18n.t('tabs.learning', { ns: 'koios', lng: 'de' })).toBe('Lernbericht')
    expect(i18n.t('learning.deniedNotTracked', { ns: 'koios', lng: 'fr' })).not.toContain('learning.')
  })
})
