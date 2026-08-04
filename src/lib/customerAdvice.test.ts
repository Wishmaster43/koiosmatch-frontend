import { describe, it, expect } from 'vitest'
import { deriveCustomerAdvice } from './customerAdvice'
import type { Customer } from '@/types/customer'

// Minimal Customer stub — only the fields the rule engine reads matter here.
function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return { id: 1, archived: false, openVacanciesCount: 3, ...overrides } as unknown as Customer
}

describe('deriveCustomerAdvice', () => {
  it('advises follow_up when the customer has zero open vacancies', () => {
    const rule = deriveCustomerAdvice(makeCustomer({ openVacanciesCount: 0 }))
    expect(rule.action).toBe('follow_up')
  })

  it('advises nothing when the customer has at least one open vacancy', () => {
    const rule = deriveCustomerAdvice(makeCustomer({ openVacanciesCount: 2 }))
    expect(rule.action).toBe('none')
  })

  it('never advises on an archived customer, even with zero open vacancies', () => {
    const rule = deriveCustomerAdvice(makeCustomer({ archived: true, openVacanciesCount: 0 }))
    expect(rule.action).toBe('none')
  })
})
