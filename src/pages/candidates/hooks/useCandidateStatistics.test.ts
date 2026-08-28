/**
 * computeCandidateStatistics — fixture tests for the derived Statistics-tab
 * numbers (STATS-HONEST-1 / B11 point 19): every block must compute correctly
 * from a known fixture, and — the honesty guard — a block whose source data is
 * absent (null, not fetched, or genuinely empty) must report an absent value
 * rather than a fabricated zero.
 */
import { describe, it, expect } from 'vitest'
import { computeCandidateStatistics } from './useCandidateStatistics'
import type { Candidate } from '@/types/candidate'
import type { Appt } from '@/pages/candidates/drawer/applicationRowModel'
import type { CandidateNote } from './useCandidateNotes'

const NOW = new Date('2026-08-13T12:00:00Z')

const baseCandidate = (overrides: Partial<Candidate> = {}): Candidate =>
  ({ id: 1, matches: [], applications: [], ...overrides } as unknown as Candidate)

describe('computeCandidateStatistics · applications by outcome', () => {
  it('groups applications by their stable stage key and counts each bucket', () => {
    const c = baseCandidate({
      applications: [
        { id: 1, stageKey: 'applied', stageLabel: 'Applied', stageColor: '#2563eb' },
        { id: 2, stageKey: 'applied', stageLabel: 'Applied', stageColor: '#2563eb' },
        { id: 3, stageKey: 'hired', stageLabel: 'Hired', stageColor: '#16a34a' },
      ] as unknown as Candidate['applications'],
    })
    const stats = computeCandidateStatistics(c, null, null, NOW)
    expect(stats.applicationsTotal).toBe(3)
    expect(stats.applicationsByOutcome).toEqual([
      { key: 'applied', label: 'Applied', color: '#2563eb', count: 2 },
      { key: 'hired', label: 'Hired', color: '#16a34a', count: 1 },
    ])
  })

  it('reports an empty bucket list — not a fake one — when there are no applications', () => {
    const stats = computeCandidateStatistics(baseCandidate(), null, null, NOW)
    expect(stats.applicationsByOutcome).toEqual([])
    expect(stats.applicationsTotal).toBe(0)
  })

  it('falls back to the stage key as label when no label is present, and skips a keyless row', () => {
    const c = baseCandidate({
      applications: [
        { id: 1, stageKey: 'invited' },
        { id: 2 },
      ] as unknown as Candidate['applications'],
    })
    const stats = computeCandidateStatistics(c, null, null, NOW)
    expect(stats.applicationsByOutcome).toEqual([{ key: 'invited', label: 'invited', color: null, count: 1 }])
  })
})

describe('computeCandidateStatistics · appointments', () => {
  const appt = (over: Partial<Appt>): Appt => ({ id: 1, ...over } as Appt)

  it('splits appointments into upcoming vs completed, excluding cancelled rows', () => {
    const appts: Appt[] = [
      appt({ id: 1, status: 'scheduled', scheduled_at: '2026-09-01T10:00:00Z' }),
      appt({ id: 2, status: 'done', scheduled_at: '2026-07-01T10:00:00Z' }),
      appt({ id: 3, status: 'cancelled', scheduled_at: '2026-09-01T10:00:00Z' }),
    ]
    const stats = computeCandidateStatistics(baseCandidate(), null, appts, NOW)
    expect(stats.appointments).toEqual({ total: 2, upcoming: 1, completed: 1 })
  })

  it('reports null — not a zero — when appointments were never fetched or came back empty', () => {
    expect(computeCandidateStatistics(baseCandidate(), null, null, NOW).appointments).toBeNull()
    expect(computeCandidateStatistics(baseCandidate(), null, [], NOW).appointments).toBeNull()
  })
})

describe('computeCandidateStatistics · notes + last contact', () => {
  it('counts notes only once the thread has actually loaded (an array, not null)', () => {
    const notes = [{ id: 1 }, { id: 2 }] as unknown as CandidateNote[]
    expect(computeCandidateStatistics(baseCandidate(), notes, null, NOW).notesCount).toBe(2)
    expect(computeCandidateStatistics(baseCandidate(), null, null, NOW).notesCount).toBeNull()
  })

  it('surfaces last contact only when the candidate record actually carries one', () => {
    const withContact = baseCandidate({ lastContactAt: '2026-08-01T00:00:00Z', lastContactType: 'phone' })
    const stats = computeCandidateStatistics(withContact, null, null, NOW)
    expect(stats.lastContactAt).toBe('2026-08-01T00:00:00Z')
    expect(stats.lastContactType).toBe('phone')
    expect(computeCandidateStatistics(baseCandidate(), null, null, NOW).lastContactAt).toBeNull()
  })
})

describe('computeCandidateStatistics · days since creation / phase change', () => {
  it('computes whole days between the stamped date and now', () => {
    const c = baseCandidate({ created: '2026-08-01T12:00:00Z', phaseChangedAt: '2026-08-10T12:00:00Z' })
    const stats = computeCandidateStatistics(c, null, null, NOW)
    expect(stats.daysSinceCreated).toBe(12)
    expect(stats.daysSincePhaseChange).toBe(3)
  })

  it('reports null for a missing, unparseable, or future date — never a negative/invented number', () => {
    expect(computeCandidateStatistics(baseCandidate(), null, null, NOW).daysSinceCreated).toBeNull()
    expect(computeCandidateStatistics(baseCandidate({ created: 'not-a-date' }), null, null, NOW).daysSinceCreated).toBeNull()
    expect(computeCandidateStatistics(baseCandidate({ phaseChangedAt: '2099-01-01' }), null, null, NOW).daysSincePhaseChange).toBeNull()
  })
})
