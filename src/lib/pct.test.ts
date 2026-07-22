import { describe, it, expect } from 'vitest'
import { largestRemainderPct } from './pct'

describe('largestRemainderPct', () => {
  // The exact case Danny hit: six equal weights must total 100, not 6×17=102.
  it('makes six equal weights sum to exactly 100', () => {
    const p = largestRemainderPct([3, 3, 3, 3, 3, 3])
    expect(p.reduce((a, b) => a + b, 0)).toBe(100)
    expect(p.filter(x => x === 17)).toHaveLength(4)
    expect(p.filter(x => x === 16)).toHaveLength(2)
  })

  it('always sums to exactly 100 for arbitrary weight sets', () => {
    for (const w of [[5, 1, 1, 1, 1, 1], [1, 2, 3, 4, 5, 3], [5, 5, 5, 1, 1, 1], [4, 4]]) {
      expect(largestRemainderPct(w).reduce((a, b) => a + b, 0)).toBe(100)
    }
  })

  it('gives the biggest share the extra point, never a smaller one', () => {
    // [2,1,1] → exact 50/25/25, floors 50/25/25 sum 100, no leftover.
    expect(largestRemainderPct([2, 1, 1])).toEqual([50, 25, 25])
  })

  it('returns zeros when the total is zero', () => {
    expect(largestRemainderPct([0, 0, 0])).toEqual([0, 0, 0])
  })
})
