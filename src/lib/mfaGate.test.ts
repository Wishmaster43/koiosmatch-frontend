/**
 * mfaGate tests — the enforcement-403 detector must only match the exact
 * status+code pair the backend contract defines (403 mfa_enrollment_required).
 */
import { describe, expect, it } from 'vitest'
import { isMfaEnrollmentError, MFA_ENROLLMENT_REQUIRED_CODE } from './mfaGate'

describe('isMfaEnrollmentError', () => {
  it('matches a 403 whose body carries the enrollment code', () => {
    const err = { response: { status: 403, data: { code: MFA_ENROLLMENT_REQUIRED_CODE } } }
    expect(isMfaEnrollmentError(err)).toBe(true)
  })

  it('rejects a 403 with a different code', () => {
    expect(isMfaEnrollmentError({ response: { status: 403, data: { code: 'forbidden' } } })).toBe(false)
    expect(isMfaEnrollmentError({ response: { status: 403, data: {} } })).toBe(false)
  })

  it('rejects other statuses even with the right code', () => {
    expect(isMfaEnrollmentError({ response: { status: 401, data: { code: MFA_ENROLLMENT_REQUIRED_CODE } } })).toBe(false)
  })

  it('tolerates malformed input without throwing', () => {
    expect(isMfaEnrollmentError(undefined)).toBe(false)
    expect(isMfaEnrollmentError(null)).toBe(false)
    expect(isMfaEnrollmentError(new Error('network'))).toBe(false)
    expect(isMfaEnrollmentError({ response: null })).toBe(false)
    expect(isMfaEnrollmentError({ response: { status: 403, data: null } })).toBe(false)
  })
})
