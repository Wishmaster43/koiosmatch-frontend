import { describe, it, expect } from 'vitest'
import { deriveMatchAdvice } from './matchAdvice'
import type { MatchRow } from '@/types/match'

const NOW = new Date('2026-08-04T12:00:00Z')

function makeMatch(overrides: Partial<MatchRow> = {}): MatchRow {
  return { id: 1, archived: false, endDate: '2026-08-20', ...overrides } as unknown as MatchRow
}

describe('deriveMatchAdvice', () => {
  it('advises renew when the open match end date is within the renewal window', () => {
    const rule = deriveMatchAdvice(makeMatch({ endDate: '2026-08-15' }), { isClosed: false, renewWithinDays: 14, now: NOW })
    expect(rule.action).toBe('renew')
  })

  it('advises renew when the end date already passed while the match is still open', () => {
    const rule = deriveMatchAdvice(makeMatch({ endDate: '2026-08-01' }), { isClosed: false, renewWithinDays: 14, now: NOW })
    expect(rule.action).toBe('renew')
  })

  it('advises nothing when the end date is far in the future', () => {
    const rule = deriveMatchAdvice(makeMatch({ endDate: '2027-01-01' }), { isClosed: false, renewWithinDays: 14, now: NOW })
    expect(rule.action).toBe('none')
  })

  it('never advises on a closed match, even with an approaching end date', () => {
    const rule = deriveMatchAdvice(makeMatch({ endDate: '2026-08-10' }), { isClosed: true, renewWithinDays: 14, now: NOW })
    expect(rule.action).toBe('none')
  })

  it('never advises on an open-ended match (no end date)', () => {
    const rule = deriveMatchAdvice(makeMatch({ endDate: null }), { isClosed: false, renewWithinDays: 14, now: NOW })
    expect(rule.action).toBe('none')
  })

  it('never advises on an archived match', () => {
    const rule = deriveMatchAdvice(makeMatch({ archived: true, endDate: '2026-08-05' }), { isClosed: false, renewWithinDays: 14, now: NOW })
    expect(rule.action).toBe('none')
  })
})
