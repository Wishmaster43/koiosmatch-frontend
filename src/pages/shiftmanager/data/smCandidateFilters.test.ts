import { describe, it, expect } from 'vitest'
import { matchesStatus, matchesSearch, filterSmCandidates } from './smCandidateFilters'
import type { ReportCandidate } from '@/types/reports'

const rows: ReportCandidate[] = [
  { id: 1, firstname: 'Anna', lastname: 'Jansen', email: 'anna@example.com', position: 'Verpleegkundige', status: 'actief' },
  { id: 2, firstname: 'Bram', lastname: 'de Vries', email: 'bram@example.com', position: 'Verzorgende', status: 'nietactief' },
  { id: 3, firstname: 'Cato', lastname: 'Smit', mobile: '0612345678', status: 'intake' },
]

describe('matchesStatus', () => {
  it('matches everything when the filter is empty', () => {
    expect(matchesStatus(rows[0], [])).toBe(true)
    expect(matchesStatus(rows[1], [])).toBe(true)
  })

  it('matches case-insensitively against the selected status values', () => {
    expect(matchesStatus(rows[0], ['actief'])).toBe(true)
    expect(matchesStatus(rows[0], ['ACTIEF'])).toBe(true)
    expect(matchesStatus(rows[0], ['nietactief'])).toBe(false)
  })
})

describe('matchesSearch', () => {
  it('matches everything for a blank query', () => {
    expect(matchesSearch(rows[0], '')).toBe(true)
    expect(matchesSearch(rows[0], '   ')).toBe(true)
  })

  it('matches on name, email, position or mobile (case-insensitive)', () => {
    expect(matchesSearch(rows[0], 'anna')).toBe(true)
    expect(matchesSearch(rows[0], 'VERPLEEGKUNDIGE')).toBe(true)
    expect(matchesSearch(rows[2], '0612345678')).toBe(true)
    expect(matchesSearch(rows[0], 'nope')).toBe(false)
  })
})

describe('filterSmCandidates', () => {
  it('combines status and search — both must match', () => {
    expect(filterSmCandidates(rows, ['actief'], '')).toEqual([rows[0]])
    expect(filterSmCandidates(rows, [], 'bram')).toEqual([rows[1]])
    // Status matches but search doesn't — no rows.
    expect(filterSmCandidates(rows, ['actief'], 'bram')).toEqual([])
  })

  it('returns every row when both filters are empty', () => {
    expect(filterSmCandidates(rows, [], '')).toEqual(rows)
  })
})
