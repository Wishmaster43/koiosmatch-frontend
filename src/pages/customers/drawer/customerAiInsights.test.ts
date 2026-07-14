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

  it('reports 100% completeness once company + headquarters fields are filled', () => {
    const c = base({
      industry: 'Zorg', website: 'https://yesway.nl', employeeCount: 40, description: 'Flexpool',
      locations: [{ isHeadquarter: true, cocNumber: '12345678', vatNumber: 'NL001', phone: '0102345678' } as never],
    })
    const [completeness] = buildCustomerAdviceInsights(c, t)
    expect(completeness.text).toBe('ai.completeGood')
  })

  it('falls back to the first location when none is flagged as headquarters', () => {
    const c = base({ locations: [{ isHeadquarter: false, cocNumber: '1', vatNumber: '2', phone: '3' } as never] })
    const [completeness] = buildCustomerAdviceInsights(c, t)
    // industry/website/employeeCount/description stay empty → 3 of 7 fields filled.
    expect(completeness.text).toBe('ai.completePartial|{"pct":43}')
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
