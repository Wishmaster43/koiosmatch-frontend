/**
 * extractApiError — preference order: first validation message → server message
 * → caller fallback; never throws on malformed/absent error shapes.
 */
import { describe, it, expect } from 'vitest'
import { extractApiError } from './extractApiError'

describe('extractApiError', () => {
  it('prefers the first validation error over the generic message', () => {
    const err = { response: { data: { message: 'The given data was invalid.', errors: { email: ['E-mail is al in gebruik.'], name: ['x'] } } } }
    expect(extractApiError(err, 'fallback')).toBe('E-mail is al in gebruik.')
  })

  it('falls back to the server message when no validation bag exists', () => {
    const err = { response: { data: { message: 'Kan niet verwijderen: in gebruik.' } } }
    expect(extractApiError(err, 'fallback')).toBe('Kan niet verwijderen: in gebruik.')
  })

  it('returns the caller fallback on network errors / malformed shapes', () => {
    expect(extractApiError(new Error('Network Error'), 'fallback')).toBe('fallback')
    expect(extractApiError(undefined, 'fallback')).toBe('fallback')
    expect(extractApiError({ response: { data: { errors: {} } } }, 'fallback')).toBe('fallback')
  })
})
