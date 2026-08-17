import { describe, it, expect } from 'vitest'
import { sumCompareMetric } from './reportCompareAggregate'
import type { CompareDiffedRow } from './reportCompareAggregate'

describe('sumCompareMetric', () => {
  it('sums current/previous/delta across every row for the given field', () => {
    const rows: CompareDiffedRow[] = [
      { key: 'a', label: 'Anna', customers: { current: 7, previous: 5, delta: 2, delta_pct: 40 } },
      { key: 'b', label: 'Bram', customers: { current: 3, previous: 2, delta: 1, delta_pct: 50 } },
    ]
    expect(sumCompareMetric(rows, 'customers')).toEqual({ current: 10, previous: 7, delta: 3, delta_pct: expect.closeTo(42.857, 2) })
  })

  it('renders a null delta_pct when the summed previous is zero — never a fabricated percentage', () => {
    const rows: CompareDiffedRow[] = [
      { key: 'a', label: 'Anna', opportunities: { current: 4, previous: 0, delta: 4, delta_pct: null } },
    ]
    expect(sumCompareMetric(rows, 'opportunities')).toEqual({ current: 4, previous: 0, delta: 4, delta_pct: null })
  })

  it('an empty row list sums to a clean zero, never NaN/Infinity', () => {
    expect(sumCompareMetric([], 'customers')).toEqual({ current: 0, previous: 0, delta: 0, delta_pct: null })
  })

  it('ignores rows missing the field (never crashes on a partial payload)', () => {
    const rows: CompareDiffedRow[] = [
      { key: 'a', label: 'Anna' },
      { key: 'b', label: 'Bram', customers: { current: 5, previous: 5, delta: 0, delta_pct: 0 } },
    ]
    expect(sumCompareMetric(rows, 'customers')).toEqual({ current: 5, previous: 5, delta: 0, delta_pct: 0 })
  })
})
