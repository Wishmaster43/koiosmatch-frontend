// noteEditGuard — the three early-return cases every editNote hook relies on
// (DRY round 11, NOTES2).
import { describe, it, expect } from 'vitest'
import { noteEditGuard } from './noteEditGuard'

describe('noteEditGuard', () => {
  it('returns null when the owning id is missing', () => {
    expect(noteEditGuard(undefined, [{ id: 1 }], 0)).toBeNull()
    expect(noteEditGuard('', [{ id: 1 }], 0)).toBeNull()
  })

  it('returns null when the index has no note', () => {
    expect(noteEditGuard('c1', [{ id: 1 }], 5)).toBeNull()
  })

  it('returns the target and a snapshot of the current list otherwise', () => {
    const notes = [{ id: 1 }, { id: 2 }]
    const result = noteEditGuard('c1', notes, 1)
    expect(result).toEqual({ target: { id: 2 }, snapshot: notes })
    expect(result?.snapshot).toBe(notes)
  })
})
