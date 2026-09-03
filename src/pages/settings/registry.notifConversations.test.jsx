/**
 * Regression test for row settings-coherence-11 (Gesprekken notifications screen).
 * A prior delivery deleted the notif_conversations registry row while every
 * existing suite stayed green — nothing pinned the row itself, the nav label, or
 * the search-palette entry. This covers all three so a re-deletion fails loudly.
 */
import { describe, it, expect } from 'vitest'
import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { NAV_GROUPS } from './registry'
import { buildSettingsSearchEntries, filterSettingsSearchEntries } from './components/settingsSearchIndex'
import settingsNl from '@/i18n/locales/nl/settings.json'
import settingsEn from '@/i18n/locales/en/settings.json'
import settingsSearchNl from '@/i18n/locales/nl/settingsSearch.json'
import settingsSearchEn from '@/i18n/locales/en/settingsSearch.json'

describe('registry — notif_conversations (settings-coherence-11 fix)', () => {
  const notifGroup = NAV_GROUPS.find((g) => g.key === 'notifications')

  it('registers notif_conversations rendering NotificationsSettings with context="gesprekken"', () => {
    const item = notifGroup?.items.find((i) => i.id === 'notif_conversations')
    expect(item).toBeTruthy()
    expect(item?.render?.().props.context).toBe('gesprekken')
  })

  // SETTINGS-TABS-FIX-1: every row in this group shares one Bell icon, not a
  // per-context icon — so this row must match its siblings, not just exist.
  it('uses the shared Bell icon like every sibling notification row', () => {
    const item = notifGroup?.items.find((i) => i.id === 'notif_conversations')
    const sibling = notifGroup?.items.find((i) => i.id === 'notif_appointments')
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

describe('nav.notif_conversations label (i18n, §5 — no silent key fallback)', () => {
  it('resolves to a real Dutch label, not the raw key', () => {
    const i18n = makeI18n('nl', { nl: { settings: settingsNl } })
    expect(i18n.t('nav.notif_conversations')).toBe('Gesprekken')
    expect(i18n.t('nav.notif_conversations')).not.toBe('nav.notif_conversations')
  })

  it('resolves to a real English label, not the raw key', () => {
    const i18n = makeI18n('en', { en: { settings: settingsEn } })
    expect(i18n.t('nav.notif_conversations')).toBe('Conversations')
    expect(i18n.t('nav.notif_conversations')).not.toBe('nav.notif_conversations')
  })
})

describe('settings search palette finds notif_conversations (§3A — always searchable)', () => {
  const notifGroup = NAV_GROUPS.find((g) => g.key === 'notifications')

  function entriesFor(lng, settingsRes, settingsSearchRes) {
    const i18n = makeI18n(lng, { [lng]: { settings: settingsRes, settingsSearch: settingsSearchRes } }, ['settings', 'settingsSearch'])
    return buildSettingsSearchEntries([notifGroup], i18n.t.bind(i18n))
  }

  it('finds the tab in Dutch by its own translated label', () => {
    const entries = entriesFor('nl', settingsNl, settingsSearchNl)
    const hits = filterSettingsSearchEntries(entries, 'gesprekken')
    expect(hits.some((h) => h.id === 'notif_conversations')).toBe(true)
  })

  it('finds the tab in English by its own translated label', () => {
    const entries = entriesFor('en', settingsEn, settingsSearchEn)
    const hits = filterSettingsSearchEntries(entries, 'conversations')
    expect(hits.some((h) => h.id === 'notif_conversations')).toBe(true)
  })
})
