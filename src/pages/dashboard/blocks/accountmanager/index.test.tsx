/**
 * accountmanager registry — asserts each entry's hasData predicate: false on an
 * empty/absent feed, true once the feed carries data.
 */
import { describe, it, expect } from 'vitest'
import { ACCOUNTMANAGER_TILES } from './index'
import type { DashData } from '@/types/dashboard'

const byId = (id: string) => ACCOUNTMANAGER_TILES.find(t => t.blockId === id)!

describe('ACCOUNTMANAGER_TILES', () => {
  it('vacanciesAttentionByCustomer self-hides on [] / absent, shows on data', () => {
    const entry = byId('block.vacanciesAttentionByCustomer')
    expect(entry.hasData({} as DashData)).toBe(false)
    expect(entry.hasData({ vacancies_attention_by_customer: [] } as DashData)).toBe(false)
    expect(entry.hasData({ vacancies_attention_by_customer: [{ vacancy_id: 'v1', title: 'X', customer: null, days_open: 1, candidates_in_process: 0, last_application_at: null }] } as DashData)).toBe(true)
  })

  it('vacanciesByCustomer self-hides on [] / absent, shows on data', () => {
    const entry = byId('block.vacanciesByCustomer')
    expect(entry.hasData({} as DashData)).toBe(false)
    expect(entry.hasData({ vacancies_by_customer: [] } as DashData)).toBe(false)
    expect(entry.hasData({ vacancies_by_customer: [{ customer_id: 'c1', name: 'X', by_status: [] }] } as DashData)).toBe(true)
  })

  it('customersByPhase self-hides when every phase has a zero count, shows once one is non-zero', () => {
    const entry = byId('block.customersByPhase')
    expect(entry.hasData({} as DashData)).toBe(false)
    expect(entry.hasData({ customers_by_phase: [{ value: 'prospect', label: 'Prospect', count: 0 }] } as DashData)).toBe(false)
    expect(entry.hasData({ customers_by_phase: [{ value: 'prospect', label: 'Prospect', count: 3 }] } as DashData)).toBe(true)
  })
})
