/**
 * matchesLifecycleView — the shared three-way lifecycle predicate (TRASH-OVERAL-2),
 * shared by matches/opportunities page filtering (see file doc).
 */
import { describe, it, expect } from 'vitest'
import { matchesLifecycleView } from './lifecycleFilter'

describe('matchesLifecycleView', () => {
  it('trash view: only pending_erase rows pass', () => {
    expect(matchesLifecycleView({ lifecycle: 'pending_erase' }, true, false)).toBe(true)
    expect(matchesLifecycleView({ lifecycle: 'archived' }, true, false)).toBe(false)
    expect(matchesLifecycleView({}, true, false)).toBe(false)
  })
  it('archived view: only archived-lifecycle rows pass', () => {
    expect(matchesLifecycleView({ lifecycle: 'archived' }, false, true)).toBe(true)
    expect(matchesLifecycleView({ lifecycle: 'pending_erase' }, false, true)).toBe(false)
  })
  it('default view: only non-archived rows pass', () => {
    expect(matchesLifecycleView({ archived: false }, false, false)).toBe(true)
    expect(matchesLifecycleView({ archived: true }, false, false)).toBe(false)
  })
})
