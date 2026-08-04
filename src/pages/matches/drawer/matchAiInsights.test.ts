/**
 * buildMatchAdviceInsights (M18) — score + contract-window readings, pure FE
 * heuristic. `now` is always fixed here (§13).
 */
import { describe, it, expect } from 'vitest'
import { buildMatchAdviceInsights } from './matchAiInsights'
import type { MatchRow } from '@/types/match'

const NOW = new Date('2026-08-04T10:00:00')
const t = (key: string, opts?: Record<string, unknown>) => `${key}${opts ? `:${JSON.stringify(opts)}` : ''}`

const base: MatchRow = {
  id: 'm1', candidate: 'Jan', initials: 'JJ', vacancy: 'Verpleegkundige', client: 'Acme',
  candidateId: null, vacancyId: null, clientId: null, score: null, stage: '', status: 'open',
  stageColor: '', owner: '', ownerId: null, ownerInitials: '', ownerColor: null, date: '',
  helloflexLink: null, shiftmanagerLink: null,
} as unknown as MatchRow

describe('buildMatchAdviceInsights', () => {
  it('reads a good score', () => {
    const [scoreInsight] = buildMatchAdviceInsights({ ...base, score: 90 }, t, NOW)
    expect(scoreInsight.text).toContain('ai.scoreGood')
    expect(scoreInsight.color).toBe('var(--color-success)')
  })

  it('reads an average score', () => {
    const [scoreInsight] = buildMatchAdviceInsights({ ...base, score: 60 }, t, NOW)
    expect(scoreInsight.text).toContain('ai.scoreAverage')
    expect(scoreInsight.color).toBe('var(--color-warning)')
  })

  it('reads a poor score', () => {
    const [scoreInsight] = buildMatchAdviceInsights({ ...base, score: 20 }, t, NOW)
    expect(scoreInsight.text).toContain('ai.scorePoor')
    expect(scoreInsight.color).toBe('var(--color-danger)')
  })

  it('reads an unknown score honestly (never a fake number)', () => {
    const [scoreInsight] = buildMatchAdviceInsights({ ...base, score: null }, t, NOW)
    expect(scoreInsight.text).toBe('ai.scoreUnknown')
  })

  it('flags an expiring contract window as a warning', () => {
    const [, windowInsight] = buildMatchAdviceInsights({ ...base, endDate: '2026-08-15', archived: false }, t, NOW)
    expect(windowInsight.text).toContain('ai.windowWarning')
    expect(windowInsight.color).toBe('var(--color-warning)')
  })

  it('flags an expired contract window as danger', () => {
    const [, windowInsight] = buildMatchAdviceInsights({ ...base, endDate: '2026-07-01', archived: false }, t, NOW)
    expect(windowInsight.text).toContain('ai.windowExpired')
    expect(windowInsight.color).toBe('var(--color-danger)')
  })

  it('reads fine for a comfortably future window', () => {
    const [, windowInsight] = buildMatchAdviceInsights({ ...base, endDate: '2026-12-01', archived: false }, t, NOW)
    expect(windowInsight.text).toBe('ai.windowFine')
    expect(windowInsight.color).toBe('var(--color-success)')
  })

  it('reads unknown when there is no end date', () => {
    const [, windowInsight] = buildMatchAdviceInsights({ ...base, endDate: null }, t, NOW)
    expect(windowInsight.text).toBe('ai.windowUnknown')
  })

  it('never warns about a closed match window, even inside the 30-day range', () => {
    const [, windowInsight] = buildMatchAdviceInsights({ ...base, endDate: '2026-08-10', archived: true }, t, NOW)
    expect(windowInsight.text).toBe('ai.windowFine')
  })
})
