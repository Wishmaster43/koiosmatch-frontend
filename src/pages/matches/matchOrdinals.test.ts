/**
 * matchOrdinals tests (§13) — the ordinal count per axis, including the
 * "no id on this match" honest-null cases and oldest-first position ordering.
 */
import { describe, it, expect } from 'vitest'
import { computeMatchOrdinals } from './matchOrdinals'
import type { MatchRow } from '@/types/match'

// Minimal row factory — only the fields the ordinal computation reads.
function row(overrides: Partial<MatchRow>): MatchRow {
  return {
    id: overrides.id ?? '1',
    candidate: '', initials: '', vacancy: '', client: '',
    candidateId: null, vacancyId: null, clientId: null,
    score: null, stage: '', status: '', stageColor: '',
    owner: '', ownerId: null, ownerInitials: '', ownerColor: null,
    date: '2026-01-01',
    helloflexLink: null, shiftmanagerLink: null,
    ...overrides,
  }
}

describe('computeMatchOrdinals', () => {
  it('returns all-null for a null match', () => {
    expect(computeMatchOrdinals([], null)).toEqual({ candidate: null, client: null, location: null, department: null })
  })

  it('positions the match by date within its candidate group, oldest first', () => {
    const rows = [
      row({ id: 'a', candidateId: 'c1', date: '2026-01-01' }),
      row({ id: 'b', candidateId: 'c1', date: '2026-03-01' }),
      row({ id: 'c', candidateId: 'c1', date: '2026-02-01' }),
    ]
    const match = rows.find(r => r.id === 'c')!
    // Chronologically: a (Jan), c (Feb), b (Mar) — c is the 2nd of 3.
    expect(computeMatchOrdinals(rows, match).candidate).toEqual({ position: 2, total: 3 })
  })

  it('is null for an axis the match has no id for (never a fake 1/1)', () => {
    const rows = [row({ id: 'a', customerLocationId: null })]
    const result = computeMatchOrdinals(rows, rows[0])
    expect(result.location).toBeNull()
    expect(result.department).toBeNull()
  })

  it('computes the client and location axes independently of the candidate axis', () => {
    const rows = [
      row({ id: 'a', clientId: 'k1', customerLocationId: 'l1', date: '2026-01-01' }),
      row({ id: 'b', clientId: 'k1', customerLocationId: 'l1', date: '2026-02-01' }),
      row({ id: 'c', clientId: 'k2', customerLocationId: 'l2', date: '2026-01-15' }),
    ]
    const match = rows.find(r => r.id === 'b')!
    const result = computeMatchOrdinals(rows, match)
    expect(result.client).toEqual({ position: 2, total: 2 })
    expect(result.location).toEqual({ position: 2, total: 2 })
  })
})
