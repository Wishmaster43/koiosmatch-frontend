/**
 * Regression test for SETTINGS-DEAD-MYNOTIF-1: MyNotificationsSettings existed
 * (281 lines, tested) but was never mounted in the registry — no import, no id
 * in the notifications group. This pins the row itself, the nav label in every
 * shipped locale, and the search-palette entry so a re-deletion fails loudly.
 */
import { describe, it, expect } from 'vitest'
import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { NAV_GROUPS } from './registry'
import { buildSettingsSearchEntries, filterSettingsSearchEntries } from './components/settingsSearchIndex'
import settingsNl from '@/i18n/locales/nl/settings.json'
import settingsEn from '@/i18n/locales/en/settings.json'
import settingsDe from '@/i18n/locales/de/settings.json'
import settingsFr from '@/i18n/locales/fr/settings.json'
import settingsEs from '@/i18n/locales/es/settings.json'
import settingsIt from '@/i18n/locales/it/settings.json'
import settingsPt from '@/i18n/locales/pt/settings.json'
import settingsSearchNl from '@/i18n/locales/nl/settingsSearch.json'
import settingsSearchEn from '@/i18n/locales/en/settingsSearch.json'

describe('registry — notif_my (SETTINGS-DEAD-MYNOTIF-1 fix)', () => {
  const notifGroup = NAV_GROUPS.find((g) => g.key === 'notifications')

  it('registers notif_my mounting MyNotificationsSettings', () => {
    const item = notifGroup?.items.find((i) => i.id === 'notif_my')
    expect(item).toBeTruthy()
    expect(item?.component?.name).toBe('MyNotificationsSettings')
  })

  // SETTINGS-TABS-FIX-1: every row in this group shares one Bell icon, not a
  // per-context icon — so this row must match its siblings, not just exist.
  it('uses the shared Bell icon like every sibling notification row', () => {
    const item = notifGroup?.items.find((i) => i.id === 'notif_my')
    const sibling = notifGroup?.items.find((i) => i.id === 'notif_escalation')
    expect(item?.icon).toBeTruthy()
    expect(item?.icon).toBe(sibling?.icon)
  })
})

// Build a minimal real i18next instance from the actual locale JSON (no mocks —
// a stubbed t() that echoes the key back would prove nothing about a missing key).
function makeI18n(lng, resources, ns = ['settings']) {
  const i18n = createInstance()
  i18n.use(initReactI18next).init({
    lng,
    resources,
    ns,
    defaultNS: 'settings',
    interpolation: { escapeValue: false },
  })
  return i18n
}

describe('nav.notif_my label (i18n, §5 — no silent key fallback, all seven locales)', () => {
  const cases = [
    ['nl', settingsNl, 'Mijn meldingen'],
    ['en', settingsEn, 'My notifications'],
    ['de', settingsDe, 'Meine Benachrichtigungen'],
    ['fr', settingsFr, 'Mes notifications'],
    ['es', settingsEs, 'Mis notificaciones'],
    ['it', settingsIt, 'Le mie notifiche'],
    ['pt', settingsPt, 'As minhas notificações'],
  ]

  it.each(cases)('resolves to a real %s label, not the raw key', (lng, resources, expected) => {
    const i18n = makeI18n(lng, { [lng]: { settings: resources } })
    expect(i18n.t('nav.notif_my')).toBe(expected)
    expect(i18n.t('nav.notif_my')).not.toBe('nav.notif_my')
  })
})

describe('settings search palette finds notif_my (§3A — always searchable)', () => {
  const notifGroup = NAV_GROUPS.find((g) => g.key === 'notifications')

  function entriesFor(lng, settingsRes, settingsSearchRes) {
    const i18n = makeI18n(lng, { [lng]: { settings: settingsRes, settingsSearch: settingsSearchRes } }, ['settings', 'settingsSearch'])
    return buildSettingsSearchEntries([notifGroup], i18n.t.bind(i18n))
  }

  it('finds the tab in Dutch by its own translated label', () => {
    const entries = entriesFor('nl', settingsNl, settingsSearchNl)
    const hits = filterSettingsSearchEntries(entries, 'mijn meldingen')
    expect(hits.some((h) => h.id === 'notif_my')).toBe(true)
  })

  it('finds the tab in English by its own translated label', () => {
    const entries = entriesFor('en', settingsEn, settingsSearchEn)
    const hits = filterSettingsSearchEntries(entries, 'my notifications')
    expect(hits.some((h) => h.id === 'notif_my')).toBe(true)
  })
})
