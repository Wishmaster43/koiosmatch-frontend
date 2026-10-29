import { describe, it, expect } from 'vitest'
import { AVAILABLE_APPS } from './AppsContext'
import nl from '@/i18n/locales/nl/settings.json'
import en from '@/i18n/locales/en/settings.json'
import de from '@/i18n/locales/de/settings.json'
import fr from '@/i18n/locales/fr/settings.json'
import es from '@/i18n/locales/es/settings.json'
import it7 from '@/i18n/locales/it/settings.json'
import pt from '@/i18n/locales/pt/settings.json'

// The catalogue label is the English source and only a fallback for brand names.
describe('AVAILABLE_APPS labels', () => {
  it('carries no Dutch literal in the source labels', () => {
    for (const app of AVAILABLE_APPS) expect(app.label).not.toMatch(/handelsregister|btw|validatie/i)
  })

  it('has an appsCatalogLabels key in all seven locales for the non-brand entries', () => {
    const locales = [nl, en, de, fr, es, it7, pt] as unknown as Array<{ appsCatalogLabels: Record<string, string> }>
    for (const id of ['kvk', 'vat']) {
      expect(AVAILABLE_APPS.some(a => a.id === id)).toBe(true)
      for (const l of locales) expect(l.appsCatalogLabels[id]).toBeTruthy()
    }
  })
})
