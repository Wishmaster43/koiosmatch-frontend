/**
 * extractFormErrors — a 422 bag maps onto the form keys (unknown keys pass through);
 * no bag → null, so the caller keeps its own extractApiError fallback.
 */
import { describe, it, expect } from 'vitest'
import { extractFormErrors, unmappedFormErrors, extractFormErrorsWithMessages } from './extractFormErrors'

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

// ONIX N-005: a 422 key no rendered field maps to (no apiToForm entry, and either a
// dotted key or not among renderedKeys) is reported as unmapped so a banner can show it.
describe('unmappedFormErrors', () => {
  it('reports a dotted key with no apiToForm entry as unmapped, with its message', () => {
    const err = { response: { data: { errors: { 'custom_fields.vog': ['The custom_fields.vog field is required.'] } } } }
    expect(unmappedFormErrors(err, API_TO_FORM)).toEqual([
      { key: 'custom_fields.vog', message: 'The custom_fields.vog field is required.' },
    ])
  })

  it('never reports a mapped key as unmapped, even when it is dotted', () => {
    const err = { response: { data: { errors: { candidate_id: ['Required'], 'custom_fields.vog': ['Required'] } } } }
    const result = unmappedFormErrors(err, { ...API_TO_FORM, 'custom_fields.vog': 'vog' })
    expect(result).toEqual([])
  })

  it('with renderedKeys given, a non-dotted unknown key not in the list is unmapped; a listed one is not', () => {
    const err = { response: { data: { errors: { note: ['Too long'], 'custom_fields.vog': ['Required'] } } } }
    const result = unmappedFormErrors(err, API_TO_FORM, ['custom_fields.vog'])
    expect(result).toEqual([{ key: 'note', message: 'Too long' }])
  })

  it('returns an empty list without a validation bag', () => {
    expect(unmappedFormErrors({ response: { data: { message: 'boom' } } }, API_TO_FORM)).toEqual([])
  })
})

describe('extractFormErrorsWithMessages — unmapped passthrough', () => {
  it('carries the unmapped list alongside the existing errors/messages shape', () => {
    const err = { response: { data: { errors: { candidate_id: ['Verplicht'], 'custom_fields.vog': ['Required'] } } } }
    const result = extractFormErrorsWithMessages(err, API_TO_FORM)
    expect(result?.errors).toEqual({ candidateId: true, 'custom_fields.vog': true })
    expect(result?.unmapped).toEqual([{ key: 'custom_fields.vog', message: 'Required' }])
  })
})
