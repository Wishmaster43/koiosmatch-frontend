import { describe, it, expect } from 'vitest'
import { isNoOrganisationError, NO_ORGANISATION_CODE } from './orphanAccount'

describe('isNoOrganisationError', () => {
  it('matches a 403 that carries the no_organisation code', () => {
    expect(isNoOrganisationError({ response: { status: 403, data: { code: NO_ORGANISATION_CODE } } })).toBe(true)
  })
  it('ignores other 403s, other codes and non-axios errors', () => {
    expect(isNoOrganisationError({ response: { status: 403, data: { code: 'mfa_enrollment_required' } } })).toBe(false)
    expect(isNoOrganisationError({ response: { status: 401, data: { code: NO_ORGANISATION_CODE } } })).toBe(false)
    expect(isNoOrganisationError({ response: { status: 403, data: null } })).toBe(false)
    expect(isNoOrganisationError(new Error('x'))).toBe(false)
    expect(isNoOrganisationError(null)).toBe(false)
  })
})
