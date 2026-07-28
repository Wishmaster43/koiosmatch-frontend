import { describe, it, expect } from 'vitest'
import { buildCustomerAdviceInsights } from './customerAiInsights'
import type { Customer } from '@/types/customer'

// Fake translate: returns the bare key, or "key|{...opts}" when interpolated.
const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key}|${JSON.stringify(opts)}` : key)

// Minimal Customer stub — only the fields the builder reads.
const base = (over: Partial<Customer> = {}) => ({
  industry: '', website: '', employeeCount: '', description: '',
  locations: [], openVacanciesCount: 0, activeMatchesCount: 0,
  ...over,
} as unknown as Customer)

describe('buildCustomerAdviceInsights', () => {
  it('reports a low completeness % with no company or location data', () => {
    const [completeness] = buildCustomerAdviceInsights(base(), t)
    expect(completeness.text).toBe('ai.completePartial|{"pct":0}')
  })

  it('reports 100% completeness once company + location fields are filled', () => {
    const c = base({
      industry: 'Zorg', website: 'https://yesway.nl', employeeCount: 40, description: 'Flexpool',
      locations: [{ cocNumber: '12345678', vatNumber: 'NL001', phone: '0102345678', address: 'Kerkstraat 1, Utrecht' } as never],
    })
    const [completeness] = buildCustomerAdviceInsights(c, t)
    expect(completeness.text).toBe('ai.completeGood')
  })

  // KLANT-ADRES-1/KLANT-KVK-1 (backend 28-07): the customer carries its own KvK/BTW/
  // address now, so the score reads THOSE first and only falls back to a location for
  // records that predate the columns. Eight fields: industry, website, employeeCount,
  // description, KvK, BTW, address, contact.
  it('falls back to the first location for a customer with no own registration/address', () => {
    const c = base({ locations: [{ cocNumber: '1', vatNumber: '2', phone: '3' } as never] })
    const [completeness] = buildCustomerAdviceInsights(c, t)
    // Only the location's KvK/BTW/phone resolve → 3 of 8 fields filled.
    expect(completeness.text).toBe('ai.completePartial|{"pct":38}')
  })

  it('scores the CUSTOMER\'s own address/registration, not a location\'s', () => {
    const c = base({
      industry: 'Zorg', website: 'https://yesway.nl', employeeCount: 40, description: 'Flexpool',
      cocNumber: '12345678', vatNumber: 'NL001B01', street: 'Kerkstraat', city: 'Utrecht', phone: '0102345678',
      locations: [],
    })
    const [completeness] = buildCustomerAdviceInsights(c, t)
    expect(completeness.text).toBe('ai.completeGood')
  })

  it('reports no relationship activity when there are no vacancies or matches', () => {
    const [, relationship] = buildCustomerAdviceInsights(base(), t)
    expect(relationship.text).toBe('ai.relationshipNone')
  })

  it('reports open vacancies + active matches when present', () => {
    const [, relationship] = buildCustomerAdviceInsights(base({ openVacanciesCount: 2, activeMatchesCount: 1 }), t)
    expect(relationship.text).toBe('ai.relationshipActive|{"vacancies":2,"matches":1}')
  })
})
