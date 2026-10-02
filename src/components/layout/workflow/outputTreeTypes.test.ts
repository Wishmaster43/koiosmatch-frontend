/**
 * outputTreeTypes — pure classifier tests (SHARED-UNIT-TEST-1: a new shared
 * unit ships with its own behaviour test, not only its adopters' suites).
 */
import { describe, it, expect } from 'vitest'
import { classifyValue, glyphFor, isBundleArray, fieldCount } from './outputTreeTypes'

describe('classifyValue', () => {
  it('treats null, undefined and empty string/array/object as empty', () => {
    expect(classifyValue(null)).toBe('empty')
    expect(classifyValue(undefined)).toBe('empty')
    expect(classifyValue('')).toBe('empty')
    expect(classifyValue([])).toBe('empty')
    expect(classifyValue({})).toBe('empty')
  })
  it('classifies the remaining JSON value types', () => {
    expect(classifyValue('x')).toBe('text')
    expect(classifyValue(42)).toBe('number')
    expect(classifyValue(true)).toBe('boolean')
    expect(classifyValue(false)).toBe('boolean')
    expect(classifyValue({ a: 1 })).toBe('object')
    expect(classifyValue([1, 2])).toBe('array')
  })
})

describe('glyphFor', () => {
  it('maps every type to its Make-style glyph, booleans by value', () => {
    expect(glyphFor('text')).toBe('T')
    expect(glyphFor('number')).toBe('#')
    expect(glyphFor('boolean', true)).toBe('✓')
    expect(glyphFor('boolean', false)).toBe('✗')
    expect(glyphFor('object')).toBe('{ }')
    expect(glyphFor('array')).toBe('[ ]')
    expect(glyphFor('empty')).toBe('∅')
  })
})

describe('isBundleArray', () => {
  it('is true only for a non-empty array of plain objects', () => {
    expect(isBundleArray([{ a: 1 }, { b: 2 }])).toBe(true)
    expect(isBundleArray([])).toBe(false)
    expect(isBundleArray([1, 2, 3])).toBe(false)
    expect(isBundleArray([{ a: 1 }, [1, 2]])).toBe(false)
    expect(isBundleArray('not-an-array')).toBe(false)
  })
})

describe('fieldCount', () => {
  it('counts own enumerable keys of a plain object, 0 for arrays/primitives/nullish', () => {
    expect(fieldCount({ a: 1, b: 2 })).toBe(2)
    expect(fieldCount({})).toBe(0)
    expect(fieldCount([1, 2, 3])).toBe(0)
    expect(fieldCount('x')).toBe(0)
    expect(fieldCount(null)).toBe(0)
  })
})
