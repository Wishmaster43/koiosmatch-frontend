/**
 * contactFieldValidation tests — pure logic, no React. Asserted against the
 * exact shape Laravel's built-in `email` rule accepts/rejects (the backend
 * rule this module mirrors — see the file header for the verified request
 * classes), so the FE never blocks a value the API would accept.
 */
import { describe, it, expect } from 'vitest'
import { isValidEmailFormat } from './contactFieldValidation'

describe('isValidEmailFormat', () => {
  it('accepts empty (optional field, required-ness checked elsewhere)', () => {
    expect(isValidEmailFormat('')).toBe(true)
    expect(isValidEmailFormat('   ')).toBe(true)
  })
  it('accepts a well-formed address', () => {
    expect(isValidEmailFormat('jan@example.nl')).toBe(true)
  })
  it('rejects a value with no @ or no domain dot', () => {
    expect(isValidEmailFormat('jan.example.nl')).toBe(false)
    expect(isValidEmailFormat('jan@example')).toBe(false)
    expect(isValidEmailFormat('n.v.t.')).toBe(false)
  })
})
