import { describe, it, expect } from 'vitest'
import { toggleInSet, toggleAllInSet } from './selectionSet'

describe('toggleInSet', () => {
  it('adds an id to an empty set', () => {
    const prev = new Set<string>()
    const next = toggleInSet(prev, 'a')
    expect(next).toEqual(new Set(['a']))
  })

  it('adds an id to a non-empty set', () => {
    const prev = new Set(['a', 'b'])
    const next = toggleInSet(prev, 'c')
    expect(next).toEqual(new Set(['a', 'b', 'c']))
  })

  it('removes an existing id', () => {
    const prev = new Set(['a', 'b', 'c'])
    const next = toggleInSet(prev, 'b')
    expect(next).toEqual(new Set(['a', 'c']))
  })

  it('does not mutate the input set', () => {
    const prev = new Set(['a', 'b'])
    const original = new Set(prev)
    toggleInSet(prev, 'c')
    expect(prev).toEqual(original)
  })

  it('works with numeric ids', () => {
    const prev = new Set([1, 2, 3])
    const next = toggleInSet(prev, 2)
    expect(next).toEqual(new Set([1, 3]))
  })
})

describe('toggleAllInSet', () => {
  it('adds all ids when none are selected', () => {
    const prev = new Set<string>()
    const ids = ['a', 'b', 'c']
    const next = toggleAllInSet(prev, ids, false)
    expect(next).toEqual(new Set(ids))
  })

  it('removes all ids when all are selected', () => {
    const prev = new Set(['a', 'b', 'c'])
    const ids = ['a', 'b', 'c']
    const next = toggleAllInSet(prev, ids, true)
    expect(next).toEqual(new Set())
  })

  it('adds all ids when some are selected', () => {
    const prev = new Set(['a'])
    const ids = ['a', 'b', 'c']
    const next = toggleAllInSet(prev, ids, false)
    expect(next).toEqual(new Set(ids))
  })

  it('removes only the specified ids', () => {
    const prev = new Set(['a', 'b', 'c', 'd'])
    const ids = ['a', 'b']
    const next = toggleAllInSet(prev, ids, true)
    expect(next).toEqual(new Set(['c', 'd']))
  })

  it('handles empty ids array', () => {
    const prev = new Set(['a', 'b'])
    const next = toggleAllInSet(prev, [], false)
    expect(next).toEqual(new Set(['a', 'b']))
  })

  it('handles empty ids array with allSelected=true', () => {
    const prev = new Set(['a', 'b'])
    const next = toggleAllInSet(prev, [], true)
    expect(next).toEqual(new Set(['a', 'b']))
  })

  it('does not mutate the input set', () => {
    const prev = new Set(['a', 'b'])
    const original = new Set(prev)
    const ids = ['a', 'b', 'c']
    toggleAllInSet(prev, ids, false)
    expect(prev).toEqual(original)
  })

  it('works with numeric ids', () => {
    const prev = new Set<number>()
    const ids = [1, 2, 3]
    const next = toggleAllInSet(prev, ids, false)
    expect(next).toEqual(new Set(ids))
  })
})
