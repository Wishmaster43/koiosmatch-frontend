/**
 * weekAggregation — pure util unit tests (BILLING-USAGE-REDESIGN-1): day→week
 * rollup, empty input, and a week that spans a month boundary.
 */
import { describe, it, expect } from 'vitest'
import { aggregateToWeeks } from './weekAggregation'
import type { DailyRow } from './dailyUsageTypes'

const day = (date: string, over: Partial<DailyRow> = {}): DailyRow => ({
  date, workflowCredits: 10, workflowAmount: 5, aiInputTokens: 100, aiOutputTokens: 50, aiAmount: 1, totalAmount: 6,
  ...over,
})

describe('aggregateToWeeks', () => {
  it('returns an empty array for empty input (no fabricated zero week)', () => {
    expect(aggregateToWeeks([])).toEqual([])
  })

  it('groups two days in the same ISO week and sums their figures', () => {
    // 2026-08-17 (Mon) and 2026-08-18 (Tue) are both ISO week 34 of 2026.
    const weeks = aggregateToWeeks([day('2026-08-17'), day('2026-08-18')])
    expect(weeks).toHaveLength(1)
    expect(weeks[0].weekKey).toBe('2026-W34')
    expect(weeks[0].weekNumber).toBe(34)
    expect(weeks[0].weekStart).toBe('2026-08-17')
    expect(weeks[0].workflowCredits).toBe(20)
    expect(weeks[0].workflowAmount).toBe(10)
    expect(weeks[0].aiInputTokens).toBe(200)
    expect(weeks[0].totalAmount).toBe(12)
  })

  it('keeps a week that spans a month boundary in one bucket', () => {
    // 2026-08-31 (Mon) starts ISO week 36, running into September.
    const weeks = aggregateToWeeks([day('2026-08-31'), day('2026-09-01'), day('2026-09-02')])
    expect(weeks).toHaveLength(1)
    expect(weeks[0].weekKey).toBe('2026-W36')
    expect(weeks[0].workflowCredits).toBe(30)
  })

  it('splits days from different weeks into separate rows, sorted ascending', () => {
    const weeks = aggregateToWeeks([day('2026-08-24'), day('2026-08-10')])
    expect(weeks.map(w => w.weekKey)).toEqual(['2026-W33', '2026-W35'])
  })

  it('keeps a year-boundary week (late-Dec days) under the ISO year of its Thursday', () => {
    // 2025-12-29 (Mon) … its Thursday (2026-01-01) falls in ISO year 2026.
    const weeks = aggregateToWeeks([day('2025-12-29')])
    expect(weeks[0].weekKey).toBe('2026-W01')
  })
})
