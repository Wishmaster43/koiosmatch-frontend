/**
 * isForbidden — a 403 is a role answer (INTERVIEW-403-1); every other shape is not.
 */
import { describe, it, expect } from 'vitest'
import { isForbidden } from './api'

describe('isForbidden', () => {
  it('is true only for an axios-shaped 403', () => {
    expect(isForbidden({ response: { status: 403 } })).toBe(true)
    expect(isForbidden({ response: { status: 500 } })).toBe(false)
    expect(isForbidden({ response: {} })).toBe(false)
    expect(isForbidden(new Error('network'))).toBe(false)
    expect(isForbidden(null)).toBe(false)
    expect(isForbidden(undefined)).toBe(false)
  })
})
