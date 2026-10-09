import { describe, it, expect } from 'vitest'
import { duplicateContactError } from './duplicateContactError'

const e422 = (errors: Record<string, unknown>) => ({ response: { data: { errors } } })

describe('duplicateContactError', () => {
  it('recognises an email duplicate and reads the existing id', () => {
    expect(duplicateContactError(e422({ email: ['contacts.duplicate.email'], duplicate_contact_id: ['c-9'] })))
      .toEqual({ field: 'email', existingId: 'c-9' })
  })
  it('recognises a phone duplicate without an id', () => {
    expect(duplicateContactError(e422({ phone: ['contacts.duplicate.phone'] }))).toEqual({ field: 'phone', existingId: null })
  })
  it('returns null for an unrelated message', () => {
    expect(duplicateContactError(e422({ email: ['The email must be valid.'] }))).toBeNull()
  })
  it('returns null without a response body', () => {
    expect(duplicateContactError(new Error('boom'))).toBeNull()
    expect(duplicateContactError(undefined)).toBeNull()
  })
})
