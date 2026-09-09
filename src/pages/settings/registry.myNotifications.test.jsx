/**
 * Regression test for the Mijn meldingen placement. History: SETTINGS-DEAD-MYNOTIF-1
 * found MyNotificationsSettings never mounted; the fix put it under Settings →
 * Notificaties. Row 32 (Danny 09-09: "Mijn meldingen maar staat bij instellingen en
 * geldt voor iedereen???") moved it to the PROFILE — a personal preference is not a
 * tenant setting. This pins the new truth: no `notif_my` row in the registry, no
 * orphan nav label in any locale, and the old deep link redirecting to the profile.
 */
import { describe, it, expect } from 'vitest'
import { NAV_GROUPS } from './registry'
import { MOVED_TO_PROFILE } from './SettingsPage'
import settingsNl from '@/i18n/locales/nl/settings.json'
import settingsEn from '@/i18n/locales/en/settings.json'
import settingsDe from '@/i18n/locales/de/settings.json'
import settingsFr from '@/i18n/locales/fr/settings.json'
import settingsEs from '@/i18n/locales/es/settings.json'
import settingsIt from '@/i18n/locales/it/settings.json'
import settingsPt from '@/i18n/locales/pt/settings.json'

describe('registry — notif_my moved to the profile (row 32)', () => {
  const notifGroup = NAV_GROUPS.find((g) => g.key === 'notifications')

  it('no longer registers notif_my under Settings → Notificaties', () => {
    expect(notifGroup?.items.find((i) => i.id === 'notif_my')).toBeUndefined()
  })

  it('redirects the old #settings/notifications/notif_my deep link to the profile notifications tab', () => {
    expect(MOVED_TO_PROFILE['notifications/notif_my']).toEqual({ tab: 'notifications' })
  })

  it('leaves no orphan nav.notif_my label behind in any shipped locale', () => {
    for (const locale of [settingsNl, settingsEn, settingsDe, settingsFr, settingsEs, settingsIt, settingsPt]) {
      expect(locale.nav).not.toHaveProperty('notif_my')
    }
  })
})
