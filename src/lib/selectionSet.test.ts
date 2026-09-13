import { describe, it, expect, vi } from 'vitest'
import { toggleInSet, toggleAllInSet, toggleInList, makeToggleIn, makeArrayToggle } from './selectionSet'

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

describe('toggleInList', () => {
  it('adds a value to an empty array', () => {
    const prev: string[] = []
    const next = toggleInList(prev, 'a')
    expect(next).toEqual(['a'])
  })

  it('adds a value to a non-empty array', () => {
    const prev = ['a', 'b']
    const next = toggleInList(prev, 'c')
    expect(next).toEqual(['a', 'b', 'c'])
  })

  it('removes an existing value', () => {
    const prev = ['a', 'b', 'c']
    const next = toggleInList(prev, 'b')
    expect(next).toEqual(['a', 'c'])
  })

  it('does not mutate the input array', () => {
    const prev = ['a', 'b']
    const original = [...prev]
    toggleInList(prev, 'c')
    expect(prev).toEqual(original)
  })

  it('preserves order of remaining values', () => {
    const prev = ['x', 'y', 'z']
    const next = toggleInList(prev, 'y')
    expect(next).toEqual(['x', 'z'])
  })
})

describe('makeToggleIn', () => {
  it('persists the toggled key with the value added', () => {
    const cfg = { phases: ['a', 'b'], statuses: ['x'] }
    const persist = vi.fn()
    const toggleIn = makeToggleIn(cfg, persist)
    toggleIn('phases')('c')
    expect(persist).toHaveBeenCalledWith({ phases: ['a', 'b', 'c'] })
  })

  it('persists the toggled key with the value removed when already present', () => {
    const cfg = { phases: ['a', 'b'] }
    const persist = vi.fn()
    const toggleIn = makeToggleIn(cfg, persist)
    toggleIn('phases')('a')
    expect(persist).toHaveBeenCalledWith({ phases: ['b'] })
  })
})

describe('makeArrayToggle', () => {
  it('calls the setter with an updater that adds a missing value', () => {
    const set = vi.fn((fn: (p: string[]) => string[]) => fn(['a']))
    const toggle = makeArrayToggle(set)
    const result = toggle('b')
    expect(result).toEqual(['a', 'b'])
  })

  it('calls the setter with an updater that removes an existing value', () => {
    const set = vi.fn((fn: (p: string[]) => string[]) => fn(['a', 'b']))
    const toggle = makeArrayToggle(set)
    const result = toggle('a')
    expect(result).toEqual(['b'])
  })
})
