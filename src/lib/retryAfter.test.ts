import { describe, it, expect } from 'vitest'
import { retryAfterOf } from './retryAfter'

describe('retryAfterOf', () => {
  it('reads retry_after off a 429', () => {
    expect(retryAfterOf({ response: { status: 429, data: { retry_after: 7 } } })).toBe(7)
  })
  it('returns null for a non-429', () => {
    expect(retryAfterOf({ response: { status: 422, data: { retry_after: 7 } } })).toBeNull()
  })
  it('returns null for a 429 without the field', () => {
    expect(retryAfterOf({ response: { status: 429, data: {} } })).toBeNull()
  })
})
