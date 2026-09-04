import { describe, it, expect } from 'vitest'
import { matchesOptionQuery } from './optionFilter'

// The three edge cases the three hand-rolled copies differed on (see the module doc comment).
describe('matchesOptionQuery', () => {
  it('matches case-insensitively', () => {
    expect(matchesOptionQuery('Amsterdam', 'AMS')).toBe(true)
    expect(matchesOptionQuery('Amsterdam', 'ams')).toBe(true)
  })

  it('trims a query with leading/trailing whitespace (SearchSelect used to skip this)', () => {
    expect(matchesOptionQuery('Amsterdam', '  ams  ')).toBe(true)
  })

  it('coerces a non-string label (ReactNode) instead of throwing (SelectMenu case)', () => {
    expect(matchesOptionQuery(42, '4')).toBe(true)
    expect(matchesOptionQuery(null, 'x')).toBe(false)
  })

  it('an empty/whitespace-only query matches everything', () => {
    expect(matchesOptionQuery('Amsterdam', '')).toBe(true)
    expect(matchesOptionQuery('Amsterdam', '   ')).toBe(true)
  })

  it('rejects a non-matching substring', () => {
    expect(matchesOptionQuery('Amsterdam', 'zzz')).toBe(false)
  })
})
