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

/**
 * KAND-ACHTERGROND-VERPLICHT-1: Laravel's own untranslated "required" template
 * (no lang/nl/validation.php on the backend, see the helper's own header) must
 * never reach the user raw — swap it for the caller's translated per-field copy
 * when it knows the field, else the caller's generic fallback. A CRAFTED domain
 * message (DocumentOwnershipGuard etc., asserted in the top describe block above)
 * must keep passing through untouched — that is the regression this guards.
 */
describe('extractApiError · raw Laravel "required" template is never shown verbatim', () => {
  it('swaps the raw English template for the caller-supplied translated field message', () => {
    const err = { response: { data: { message: 'The given data was invalid.', errors: { employer: ['The employer field is required.'] } } } }
    expect(extractApiError(err, 'fallback', { employer: 'Bedrijf is verplicht.' })).toBe('Bedrijf is verplicht.')
  })

  it('falls back to the generic fallback when the caller has no label for that field', () => {
    const err = { response: { data: { errors: { employer: ['The employer field is required.'] } } } }
    expect(extractApiError(err, 'fallback')).toBe('fallback')
    expect(extractApiError(err, 'fallback', { last_name: 'Achternaam is verplicht.' })).toBe('fallback')
  })

  it('still surfaces a hand-crafted (non-template) validation message untouched', () => {
    const err = { response: { data: { errors: { document_id: ['Dit document is al aan een ander onderdeel gekoppeld.'] } } } }
    expect(extractApiError(err, 'fallback', { document_id: 'should never win' })).toBe('Dit document is al aan een ander onderdeel gekoppeld.')
  })

  it('recognises the template with a multi-word attribute (underscore → space)', () => {
    const err = { response: { data: { errors: { last_name: ['The last name field is required.'] } } } }
    expect(extractApiError(err, 'fallback', { last_name: 'Achternaam is verplicht.' })).toBe('Achternaam is verplicht.')
  })
})
