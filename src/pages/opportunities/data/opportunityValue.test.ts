/**
 * opportunityValue — GETALLEN-1 regression: the hours branch used to interpolate
 * the raw number straight into the i18n string (no thousands separator, unlike
 * the euro branch which already went through formatCurrency). Locks in that the
 * hours branch is now pre-formatted with the house number formatter too.
 */
import { describe, it, expect } from 'vitest'
import i18n from '@/i18n'
import { opportunityValueOf, formatOpportunityValue } from './opportunityValue'

describe('opportunityValueOf', () => {
  it('picks hours for an hours-typed deal, euro value for untyped/euro deals, null for a quote', () => {
    expect(opportunityValueOf({ value: 100, hours: 40, dealTypeUnit: 'hours' })).toBe(40)
    expect(opportunityValueOf({ value: 100, hours: 40, dealTypeUnit: null })).toBe(100)
    expect(opportunityValueOf({ value: 100, hours: 40, dealTypeUnit: 'quote' })).toBeNull()
  })
})

describe('formatOpportunityValue (GETALLEN-1)', () => {
  it('formats a euro deal via the house currency formatter with thousands separator', () => {
    const out = formatOpportunityValue({ value: 125000, hours: null, dealTypeUnit: null }, i18n.t, 'EUR', 'nl-NL')
    // Intl inserts a non-breaking space between the symbol and the amount.
    expect(out).toBe('€ 125.000')
  })

  it('formats an hours-typed deal with a thousands separator, not the raw number', () => {
    const out = formatOpportunityValue({ value: null, hours: 1800, dealTypeUnit: 'hours' }, i18n.t, 'EUR', 'nl-NL')
    expect(out).toBe('1.800 u')
    expect(out).not.toContain('1800')
  })

  it('returns the em-dash placeholder for a quote (no numeric value)', () => {
    const out = formatOpportunityValue({ value: 100, hours: 40, dealTypeUnit: 'quote' }, i18n.t, 'EUR', 'nl-NL')
    expect(out).toBe('—')
  })
})
