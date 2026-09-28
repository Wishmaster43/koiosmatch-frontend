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
    // KOIOS-ROW-2 (Danny 10-09 15:30): the handoff asks a question that fits the row's kind.
    expect(i18n.t('koios.assistant.askIntentByKind.task_overdue', { ns: 'common', lng: 'nl', title: 'Lieke Groen bellen' })).toBe('Taak "Lieke Groen bellen" staat nog open. Wat is de stand en wat stel je voor: afronden, verzetten of contact opnemen?')
    expect(i18n.t('koios.assistant.askIntentByKind.vacancy_zero_applications', { ns: 'common', lng: 'nl', title: 'Verzorgende IG | Amsterdam' })).toContain('Zoek geschikte kandidaten voor vacature "Verzorgende IG | Amsterdam"')
    for (const kind of ['task_overdue', 'candidate_no_contact', 'vacancy_zero_applications', 'opportunity_closing_soon', 'pending_action']) {
      expect(i18n.exists(`koios.assistant.askIntentByKind.${kind}`, { ns: 'common', lng: 'en' }), kind).toBe(true)
    }
    expect(i18n.t('koios.assistant.askKoios', { ns: 'common', lng: 'de' })).toBe('Im Chat abschließen')
  })

  // KOIOS-SUGGEST-COMPACT-1 (CMBE addendum 28-09): the row's action icon buttons
  // read their accessible name from these keys — pinned against REAL EN copy,
  // since the component suite itself only proves the KEY was requested.
  it('resolves the compact-suggestion action + tool + reason keys', () => {
    expect(i18n.t('koios.assistant.actions.complete_task', { ns: 'common', lng: 'en' })).toBe('Complete')
    expect(i18n.t('koios.assistant.actions.reschedule_task', { ns: 'common', lng: 'en' })).toBe('Reschedule')
    expect(i18n.t('koios.assistant.actions.send_whatsapp', { ns: 'common', lng: 'en' })).toBe('Send WhatsApp')
    expect(i18n.t('koios.assistant.actions.create_task', { ns: 'common', lng: 'en' })).toBe('Create task')
    expect(i18n.t('koios.assistant.actions.search_candidates', { ns: 'common', lng: 'en' })).toBe('Search candidates')
    for (const tool of ['wijzig_taak', 'maak_taak', 'stuur_whatsapp', 'zoek_kandidaten', 'unknown']) {
      expect(i18n.exists(`koios.tools.${tool}`, { ns: 'common', lng: 'en' }), tool).toBe(true)
    }
    // A day count runs the real ICU plural (i18next _one/_other), not the raw key.
    expect(i18n.t('koios.assistant.reason.task_overdue', { ns: 'common', lng: 'en', count: 1 })).toBe('1 day overdue')
    expect(i18n.t('koios.assistant.reason.task_overdue', { ns: 'common', lng: 'en', count: 4 })).toBe('4 days overdue')
    expect(i18n.t('koios.assistant.reasonShort.pending_action', { ns: 'common', lng: 'en' })).toBe('Suggestion')
  })

  it('resolves the learning card + tab keys from the koios namespace', () => {
    expect(i18n.t('learning.topQuestions', { ns: 'koios', lng: 'nl' })).toBe('Meest gestelde vragen')
    expect(i18n.t('tabs.learning', { ns: 'koios', lng: 'de' })).toBe('Lernbericht')
    expect(i18n.t('learning.deniedNotTracked', { ns: 'koios', lng: 'fr' })).not.toContain('learning.')
  })
})
