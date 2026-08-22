/**
 * opportunityOrdinals tests (§13) — the customer-axis ordinal count, including
 * the "no clientId on this deal" honest-null case and oldest-first position ordering.
 */
import { describe, it, expect } from 'vitest'
import { computeOpportunityOrdinal, otherOpportunitiesForClient } from './opportunityOrdinals'
import type { Opportunity } from '@/types/opportunity'

// Minimal row factory — only the fields the ordinal computation reads.
function row(overrides: Partial<Opportunity>): Opportunity {
  return {
    id: overrides.id ?? '1', title: '', description: '', initials: '', client: '', clientId: null,
    stage: '', stageValue: null, stageColor: '', value: null, currency: 'EUR', owner: '', ownerId: null,
    date: '2026-01-01', expectedCloseAt: null, dealTypeUnit: null, archived: false, archivedAt: null,
    lifecycle: 'active', pendingEraseAt: null, hours: null, hoursPeriod: 'week', startDate: null, endDate: null,
    serviceType: '', serviceTypeValue: null, serviceTypeColor: '', serviceTypeId: null,
    agreementType: '', agreementTypeValue: null, agreementTypeColor: '', agreementTypeId: null,
    location: '', locationId: null, department: '', departmentId: null, contact: '', contactId: null,
    branch: '', branchId: null, tags: [], customFieldValues: {},
    ...overrides,
  } as Opportunity
}

describe('computeOpportunityOrdinal', () => {
  it('returns null for a null opportunity', () => {
    expect(computeOpportunityOrdinal([], null)).toBeNull()
  })

  it('is null for a deal with no clientId (never a fake 1/1)', () => {
    const rows = [row({ id: 'a', clientId: null })]
    expect(computeOpportunityOrdinal(rows, rows[0])).toBeNull()
  })

  it('positions the deal by date within its customer group, oldest first', () => {
    const rows = [
      row({ id: 'a', clientId: 'c1', date: '2026-01-01' }),
      row({ id: 'b', clientId: 'c1', date: '2026-03-01' }),
      row({ id: 'c', clientId: 'c1', date: '2026-02-01' }),
    ]
    const deal = rows.find(r => r.id === 'c')!
    // Chronologically: a (Jan), c (Feb), b (Mar) — c is the 2nd of 3.
    expect(computeOpportunityOrdinal(rows, deal)).toEqual({ position: 2, total: 3 })
  })

  it('computes the customer axis independently of unrelated deals', () => {
    const rows = [
      row({ id: 'a', clientId: 'k1', date: '2026-01-01' }),
      row({ id: 'b', clientId: 'k1', date: '2026-02-01' }),
      row({ id: 'c', clientId: 'k2', date: '2026-01-15' }),
    ]
    const deal = rows.find(r => r.id === 'b')!
    expect(computeOpportunityOrdinal(rows, deal)).toEqual({ position: 2, total: 2 })
  })
})

describe('otherOpportunitiesForClient', () => {
  it('returns an empty list for a null opportunity', () => {
    expect(otherOpportunitiesForClient([], null)).toEqual([])
  })

  it('is empty for a deal with no clientId (never a fake entry)', () => {
    const rows = [row({ id: 'a', clientId: null })]
    expect(otherOpportunitiesForClient(rows, rows[0])).toEqual([])
  })

  it('excludes the deal itself and orders the rest oldest-first', () => {
    const rows = [
      row({ id: 'a', clientId: 'c1', date: '2026-01-01' }),
      row({ id: 'b', clientId: 'c1', date: '2026-03-01' }),
      row({ id: 'c', clientId: 'c1', date: '2026-02-01' }),
    ]
    const deal = rows.find(r => r.id === 'c')!
    // Chronologically excluding c: a (Jan), b (Mar).
    expect(otherOpportunitiesForClient(rows, deal).map(r => r.id)).toEqual(['a', 'b'])
  })

  it('returns an empty list when this deal is the ONLY one for this customer', () => {
    const rows = [row({ id: 'a', clientId: 'k1' })]
    expect(otherOpportunitiesForClient(rows, rows[0])).toEqual([])
  })

  it('excludes deals at a DIFFERENT customer, self-excluded from its own group', () => {
    const rows = [
      row({ id: 'a', clientId: 'k1', date: '2026-01-01' }),
      row({ id: 'b', clientId: 'k1', date: '2026-02-01' }),
      row({ id: 'c', clientId: 'k2', date: '2026-01-15' }),
    ]
    const deal = rows.find(r => r.id === 'b')!
    expect(otherOpportunitiesForClient(rows, deal).map(r => r.id)).toEqual(['a'])
  })
})
