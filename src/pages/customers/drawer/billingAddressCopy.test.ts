/**
 * The invoice-address block shipped rendering RAW DOTTED KEYS in all five locales — a card
 * titled literally "overview.billingAddress.title" with a field labelled
 * "overview.billingAddress.poBox". Its own test suite could not see it: that file stubs
 * i18n so t() echoes the key, so the twelve tests asserted the broken strings AS THE
 * EXPECTED VALUES. Green tests, dead surface.
 *
 * This one reads the real locale files instead. It is deliberately not a render test: the
 * defect was never in the rendering, it was that the copy did not exist.
 */
import { describe, it, expect } from 'vitest'
import nl from '@/i18n/locales/nl/customers.json'
import en from '@/i18n/locales/en/customers.json'
import de from '@/i18n/locales/de/customers.json'
import fr from '@/i18n/locales/fr/customers.json'
import es from '@/i18n/locales/es/customers.json'

// Every key PriceAgreementsTab asks for under this branch.
const USED = ['title', 'poBox', 'usesVisitAddress', 'visitEmpty', 'hint'] as const
const LOCALES = { nl, en, de, fr, es } as Record<string, { overview?: { billingAddress?: Record<string, string> } }>

describe('factuuradres — de teksten bestaan echt', () => {
  it.each(Object.keys(LOCALES))('%s carries every billingAddress string', locale => {
    const block = LOCALES[locale].overview?.billingAddress
    expect(block, `overview.billingAddress ontbreekt in ${locale}`).toBeTruthy()
    for (const key of USED) {
      const value = block?.[key]
      expect(value, `overview.billingAddress.${key} ontbreekt in ${locale}`).toBeTruthy()
      // A key that leaked into the value is the exact bug this guards against.
      expect(String(value)).not.toContain('billingAddress.')
    }
  })
})
