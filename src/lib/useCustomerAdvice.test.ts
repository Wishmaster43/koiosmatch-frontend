import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import '@/i18n'
import { useCustomerAdvice } from './useCustomerAdvice'
import type { Customer } from '@/types/customer'

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return { id: 1, archived: false, openVacanciesCount: 3, ...overrides } as unknown as Customer
}

// S1 K-266/K-267: customer never had a backend-tagged advice engine (the old
// `koios_advice` column was never filled and has been renamed to the SEPARATE
// `koios_ai_advice` cache) — the local rule engine is now the only source.
describe('useCustomerAdvice — local rule engine (no backend variant)', () => {
  it('fires follow_up for a customer with zero open vacancies', () => {
    const { result } = renderHook(() => useCustomerAdvice())
    const c = makeCustomer({ openVacanciesCount: 0 })
    const advice = result.current(c)
    expect(advice).not.toBeNull()
    expect(advice!.action).toBe('follow_up')
    expect(advice!.source).toBe('rules')
  })

  it('stays null when the customer has open vacancies', () => {
    const { result } = renderHook(() => useCustomerAdvice())
    const c = makeCustomer({ openVacanciesCount: 3 })
    expect(result.current(c)).toBeNull()
  })

  it('never advises on an archived customer', () => {
    const { result } = renderHook(() => useCustomerAdvice())
    const c = makeCustomer({ archived: true, openVacanciesCount: 0 })
    expect(result.current(c)).toBeNull()
  })
})
