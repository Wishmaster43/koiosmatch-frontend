/**
 * mergeCustomFields (X-37, K-27) — the pure rules the merge modal's third step rests
 * on: only a value present on BOTH sides and different is a collision; a one-sided
 * value is absorbed; the survivor wins by default; false/0 are real values.
 */
import { describe, it, expect } from 'vitest'
import { computeCustomFieldConflicts, customFieldsChanged, isEmptyCustomValue, mergeCustomFieldMaps } from './mergeCustomFields'

describe('isEmptyCustomValue', () => {
  it('treats null, undefined and the empty string as no value, but not false or 0', () => {
    expect(isEmptyCustomValue(null)).toBe(true)
    expect(isEmptyCustomValue(undefined)).toBe(true)
    expect(isEmptyCustomValue('')).toBe(true)
    expect(isEmptyCustomValue(false)).toBe(false)
    expect(isEmptyCustomValue(0)).toBe(false)
  })
})

describe('computeCustomFieldConflicts', () => {
  it('lists only keys where both sides hold a different value', () => {
    const survivor = { region: 'Noord', vog: true, start: '2026-01-05', empty: '', missing: null }
    const source = { region: 'Zuid', vog: true, start: '2026-09-08', empty: 'x', missing: 'y', extra: 'z' }
    expect(computeCustomFieldConflicts(survivor, source)).toEqual(['region', 'start'])
  })

  it('counts false versus true as a collision (a boolean field is never "empty")', () => {
    expect(computeCustomFieldConflicts({ vog: false }, { vog: true })).toEqual(['vog'])
  })

  it('is empty when nothing collides', () => {
    expect(computeCustomFieldConflicts({ a: 1 }, { a: 1, b: 2 })).toEqual([])
    expect(computeCustomFieldConflicts({}, {})).toEqual([])
  })
})

describe('mergeCustomFieldMaps', () => {
  const survivor = { region: 'Noord', vog: true, note: '' }
  const source = { region: 'Zuid', vog: true, note: 'hello', start: '2026-09-08', blank: '' }

  it('keeps the survivor value by default and absorbs the source where the survivor is empty', () => {
    expect(mergeCustomFieldMaps(survivor, source, {})).toEqual({ region: 'Noord', vog: true, note: 'hello', start: '2026-09-08' })
  })

  it('takes the source value only where that side was chosen', () => {
    expect(mergeCustomFieldMaps(survivor, source, { region: 'source' })).toEqual({ region: 'Zuid', vog: true, note: 'hello', start: '2026-09-08' })
  })

  it('never copies an empty source value and never drops a survivor-only key', () => {
    expect(mergeCustomFieldMaps({ only: 'mine', note: 'keep' }, { note: '', blank: null }, {})).toEqual({ only: 'mine', note: 'keep' })
  })
})

describe('customFieldsChanged', () => {
  it('is false for the same map regardless of key order, true on any value change', () => {
    expect(customFieldsChanged({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(false)
    expect(customFieldsChanged({ a: 1 }, { a: 1, b: 2 })).toBe(true)
    expect(customFieldsChanged({ a: 1 }, { a: 2 })).toBe(true)
  })
})
