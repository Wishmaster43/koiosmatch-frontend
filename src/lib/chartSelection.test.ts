/**
 * chartSelection — pickKey/toggleOneValue, shared by customers/vacancies
 * insights config builders (see file doc).
 */
import { describe, it, expect, vi } from 'vitest'
import { pickKey, toggleOneValue } from './chartSelection'

describe('pickKey', () => {
  it('reads a top-level key first', () => {
    expect(pickKey({ key: 'a', name: 'b' })).toBe('a')
  })
  it('falls back to payload.key, then name', () => {
    expect(pickKey({ payload: { key: 'p' } })).toBe('p')
    expect(pickKey({ name: 'n' })).toBe('n')
  })
  it('returns undefined for null/undefined input', () => {
    expect(pickKey(null)).toBeUndefined()
    expect(pickKey(undefined)).toBeUndefined()
  })
})

describe('toggleOneValue', () => {
  it('sets a single value when nothing selected', () => {
    const set = vi.fn(fn => fn([]))
    toggleOneValue(set, 'x')
    expect(set).toHaveBeenCalled()
    expect(set.mock.calls[0][0]([])).toEqual(['x'])
  })
  it('clears when the same single value is picked again', () => {
    const set = vi.fn(fn => fn(['x']))
    toggleOneValue(set, 'x')
    expect(set.mock.calls[0][0](['x'])).toEqual([])
  })
})
