/**
 * filterValueToken — round-trip tests for the mapping-token syntax (ADDENDUM 2).
 */
import { describe, it, expect } from 'vitest'
import { filterValueToken, isFilterValueToken, parseFilterValueToken } from './filterValueToken'

describe('filterValueToken', () => {
  it('spells {{N.field}}', () => {
    expect(filterValueToken(2, 'status')).toBe('{{2.status}}')
  })
})

describe('isFilterValueToken', () => {
  it('is true for a whole-string token, false for mixed text or a literal', () => {
    expect(isFilterValueToken('{{2.status}}')).toBe(true)
    expect(isFilterValueToken('actief,{{2.status}}')).toBe(false)
    expect(isFilterValueToken('actief')).toBe(false)
  })
})

describe('parseFilterValueToken', () => {
  it('parses the numbered form', () => {
    expect(parseFilterValueToken('{{2.status}}')).toEqual({ number: 2, field: 'status', format: undefined })
  })

  it('parses the bare form with no module number', () => {
    expect(parseFilterValueToken('{{status}}')).toEqual({ number: null, field: 'status', format: undefined })
  })

  it('parses a trailing |format suffix', () => {
    expect(parseFilterValueToken('{{3.start_time|H:i}}')).toEqual({ number: 3, field: 'start_time', format: 'H:i' })
  })

  it('returns null for a non-token string', () => {
    expect(parseFilterValueToken('actief')).toBeNull()
  })

  it('round-trips with filterValueToken', () => {
    const token = filterValueToken(5, 'first_name')
    expect(parseFilterValueToken(token)).toEqual({ number: 5, field: 'first_name', format: undefined })
  })
})
