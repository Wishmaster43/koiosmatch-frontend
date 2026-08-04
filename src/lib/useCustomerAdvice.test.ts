import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import '@/i18n'
import { useCustomerAdvice } from './useCustomerAdvice'
import type { Customer } from '@/types/customer'

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return { id: 1, archived: false, openVacanciesCount: 3, koiosAdvice: null, ...overrides } as unknown as Customer
}

describe('useCustomerAdvice — honest gate (no source → local engine answers)', () => {
  it('ignores a sourceless backend advice and falls back to the local rule engine', () => {
    const { result } = renderHook(() => useCustomerAdvice())
    // Backend advice carries no `source` — the seeded-random legacy shape — so the
    // local engine (openVacanciesCount > 0 here) must answer instead, i.e. null.
    const c = makeCustomer({ koiosAdvice: { action: 'follow_up', reason: 'Random seeded text' } })
    expect(result.current(c)).toBeNull()
  })

  it('the local engine fires follow_up for a customer with zero open vacancies', () => {
    const { result } = renderHook(() => useCustomerAdvice())
    const c = makeCustomer({ openVacanciesCount: 0, koiosAdvice: null })
    const advice = result.current(c)
    expect(advice).not.toBeNull()
    expect(advice!.action).toBe('follow_up')
    expect(advice!.source).toBe('rules')
  })

  it('never advises on an archived customer', () => {
    const { result } = renderHook(() => useCustomerAdvice())
    const c = makeCustomer({ archived: true, openVacanciesCount: 0 })
    expect(result.current(c)).toBeNull()
  })
})

describe('useCustomerAdvice — backend engine (source tagged)', () => {
  it('trusts a tagged backend action/reason verbatim', () => {
    const { result } = renderHook(() => useCustomerAdvice())
    const c = makeCustomer({ koiosAdvice: { action: 'follow_up', label: 'Opvolgen', reason: 'Backend reason', source: 'engine' } })
    const advice = result.current(c)
    expect(advice).toEqual({ action: 'follow_up', label: 'Opvolgen', reason: 'Backend reason', source: 'engine' })
  })

  it('a backend action of "none" yields null even with a tagged source', () => {
    const { result } = renderHook(() => useCustomerAdvice())
    const c = makeCustomer({ koiosAdvice: { action: 'none', source: 'engine' } })
    expect(result.current(c)).toBeNull()
  })
})
