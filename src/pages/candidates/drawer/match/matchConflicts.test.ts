/**
 * matchConflicts — pure-function coverage for the duplicate/overlap preflight
 * (points 5/6, Danny's ten-point round: 1.10/1.11). No React/hooks involved —
 * tests the exact date-range and cascade-scope math in isolation.
 */
import { describe, it, expect } from 'vitest'
import { findDuplicateMatch, findOverlappingMatches } from './matchConflicts'
import type { ExistingMatchRow } from './matchConflicts'

// A minimal existing-match fixture — only the fields the two functions read.
const row = (overrides: Partial<ExistingMatchRow> = {}): ExistingMatchRow => ({
  id: 'm-1', vacancyTitle: 'Verzorgende IG', client: 'Zorggroep A',
  customerId: 'cust-1', customerLocationId: null, customerDepartmentId: null,
  status: 'open', startDate: '2026-01-01', endDate: '2026-06-30',
  ...overrides,
})

// A status metadata resolver mirroring useMatchStatuses' DEFAULT_MATCH_STATUSES
// seed (open = active, closed = not).
const isActiveStatus = (status: string | null) => status !== 'closed'

describe('findDuplicateMatch', () => {
  it('returns null when no customer is picked yet', () => {
    expect(findDuplicateMatch([row()], '', '', '')).toBeNull()
  })

  it('finds a match on customer alone when the draft has no location/department picked', () => {
    expect(findDuplicateMatch([row()], 'cust-1', '', '')).toEqual(row())
  })

  it('does not match a different customer', () => {
    expect(findDuplicateMatch([row()], 'cust-2', '', '')).toBeNull()
  })

  it('requires the location to match too, once the draft specifies one', () => {
    const withLoc = row({ customerLocationId: 'loc-1' })
    expect(findDuplicateMatch([withLoc], 'cust-1', 'loc-1', '')).toEqual(withLoc)
    expect(findDuplicateMatch([withLoc], 'cust-1', 'loc-2', '')).toBeNull()
  })

  it('requires the department to match too, once the draft specifies one', () => {
    const withDept = row({ customerLocationId: 'loc-1', customerDepartmentId: 'dep-1' })
    expect(findDuplicateMatch([withDept], 'cust-1', 'loc-1', 'dep-1')).toEqual(withDept)
    expect(findDuplicateMatch([withDept], 'cust-1', 'loc-1', 'dep-2')).toBeNull()
  })
})

describe('findOverlappingMatches', () => {
  it('returns [] when the draft has no start date yet', () => {
    expect(findOverlappingMatches([row()], '', '2026-06-01', isActiveStatus)).toEqual([])
  })

  it('flags an overlapping ACTIVE match', () => {
    // Existing: 2026-01-01..2026-06-30; draft: 2026-05-01..2026-08-01 → overlaps.
    expect(findOverlappingMatches([row()], '2026-05-01', '2026-08-01', isActiveStatus)).toEqual([row()])
  })

  it('does not flag a match with no date overlap at all', () => {
    // Existing ends 2026-06-30; draft starts 2026-07-01 → no overlap.
    expect(findOverlappingMatches([row()], '2026-07-01', '2026-12-31', isActiveStatus)).toEqual([])
  })

  it('touches on the boundary date and counts as an overlap (inclusive)', () => {
    expect(findOverlappingMatches([row()], '2026-06-30', '2026-12-31', isActiveStatus)).toEqual([row()])
  })

  it('treats a null existing end date as still ongoing (open-ended)', () => {
    const ongoing = row({ endDate: null })
    expect(findOverlappingMatches([ongoing], '2027-01-01', '2027-06-01', isActiveStatus)).toEqual([ongoing])
  })

  it('never flags a CLOSED (ended) match, even with an overlapping period', () => {
    const closed = row({ status: 'closed' })
    expect(findOverlappingMatches([closed], '2026-05-01', '2026-08-01', isActiveStatus)).toEqual([])
  })

  it('treats an unresolvable status as active (a false warning is safe, a missed one is not)', () => {
    const unknown = row({ status: 'some_unmapped_slug' })
    const alwaysUnresolved = () => true // metaOf() found nothing → the house's isActiveStatus fallback
    expect(findOverlappingMatches([unknown], '2026-05-01', '2026-08-01', alwaysUnresolved)).toEqual([unknown])
  })

  it('an open-ended DRAFT (no end date) still overlaps a match starting later within the draft period', () => {
    const later = row({ startDate: '2026-09-01', endDate: '2026-10-01' })
    expect(findOverlappingMatches([later], '2026-01-01', '', isActiveStatus)).toEqual([later])
  })
})
