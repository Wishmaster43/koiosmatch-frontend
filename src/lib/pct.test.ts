import { describe, it, expect } from 'vitest'
import { largestRemainderPct } from './pct'

describe('largestRemainderPct', () => {
  it('integer shares always total exactly 100', () => {
    for (const w of [[3, 3, 3, 3, 3, 3], [5, 1, 1, 1, 1, 1], [1, 2, 3, 4, 5, 3], [4, 4]]) {
      expect(largestRemainderPct(w).reduce((a, b) => a + b, 0)).toBe(100)
    }
  })

  // Danny 22-07: six equal weights must total exactly 100 while looking equal — with one
  // decimal that's four 16,7 + two 16,6 (a 0,1 gap), not the jarring 17/16 integer split.
  it('one-decimal shares of six equal weights total 100 and stay near-equal', () => {
    const p = largestRemainderPct([3, 3, 3, 3, 3, 3], 1)
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6)
    const tenths = p.map(x => Math.round(x * 10))
    expect(tenths.filter(x => x === 167)).toHaveLength(4)
    expect(tenths.filter(x => x === 166)).toHaveLength(2)
  })

  it('one-decimal shares always total exactly 100 for arbitrary weights', () => {
    for (const w of [[5, 1, 1, 1, 1, 1], [1, 2, 3, 4, 5, 3], [7, 3]]) {
      expect(largestRemainderPct(w, 1).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6)
    }
  })

  it('returns zeros when the total is zero', () => {
    expect(largestRemainderPct([0, 0, 0])).toEqual([0, 0, 0])
  })
})
