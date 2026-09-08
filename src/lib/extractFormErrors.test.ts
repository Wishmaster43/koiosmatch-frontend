/**
 * extractFormErrors — a 422 bag maps onto the form keys (unknown keys pass through);
 * no bag → null, so the caller keeps its own extractApiError fallback.
 */
import { describe, it, expect } from 'vitest'
import { extractFormErrors } from './extractFormErrors'

const API_TO_FORM = { candidate_id: 'candidateId', vacancy_id: 'vacancyId' }

describe('extractFormErrors', () => {
  it('maps a 422 bag onto form keys and passes unknown keys through', () => {
    const err = { response: { status: 422, data: { message: 'x', errors: { candidate_id: ['Verplicht'], note: ['Te lang'] } } } }
    expect(extractFormErrors(err, API_TO_FORM)).toEqual({ candidateId: true, note: true })
  })

  it('returns null without a validation bag (network error, 500, plain message)', () => {
    expect(extractFormErrors({ response: { status: 500, data: { message: 'boom' } } }, API_TO_FORM)).toBeNull()
    expect(extractFormErrors(new Error('offline'), API_TO_FORM)).toBeNull()
  })
})
