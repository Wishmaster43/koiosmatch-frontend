/**
 * C1 key-resolution pin (SCHERMWAARHEID-1): the assistant + learning surfaces'
 * component tests run a key-echoing i18n stub, so THIS test proves against the
 * REAL i18n init that the keys resolve to shipped copy — a missing key would
 * echo itself here and fail loudly instead of shipping raw keys to the screen.
 */
import { describe, it, expect } from 'vitest'
import i18n from '@/i18n'

describe('C1 assistant/learning i18n keys resolve', () => {
  it('resolves the assistant block keys from the common namespace', () => {
    expect(i18n.t('koios.assistant.title', { ns: 'common', lng: 'nl' })).toBe('Koios stelt voor')
    expect(i18n.t('koios.assistant.emptyState', { ns: 'common', lng: 'en' })).toBe('Nothing needs your attention right now.')
  })

  it('resolves the learning card + tab keys from the koios namespace', () => {
    expect(i18n.t('learning.topQuestions', { ns: 'koios', lng: 'nl' })).toBe('Meest gestelde vragen')
    expect(i18n.t('tabs.learning', { ns: 'koios', lng: 'de' })).toBe('Lernbericht')
    expect(i18n.t('learning.deniedNotTracked', { ns: 'koios', lng: 'fr' })).not.toContain('learning.')
  })
})
