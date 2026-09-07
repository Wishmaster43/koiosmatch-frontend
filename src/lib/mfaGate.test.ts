/**
 * mfaGate tests — the enforcement-403 detector must only match the exact
 * status+code pair the backend contract defines (403 mfa_enrollment_required).
 */
import { describe, expect, it } from 'vitest'
import { mfaSignals, isMfaEnrollmentError, MFA_ENROLLMENT_REQUIRED_CODE } from './mfaGate'

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

// MFA-GATE-SPLIT-1: the soft policy flag nudges, only mfa_enrollment_blocked walls.
describe('mfaSignals', () => {
  it('mfa_setup_required alone is only the soft nudge (older payload and the split contract alike)', () => {
    expect(mfaSignals({ mfa_setup_required: true })).toEqual({ hard: false, soft: true })
    expect(mfaSignals({ mfa_setup_required: true, mfa_enrollment_blocked: false })).toEqual({ hard: false, soft: true })
  })
  it('mfa_enrollment_blocked is the wall', () => {
    expect(mfaSignals({ mfa_setup_required: true, mfa_enrollment_blocked: true })).toEqual({ hard: true, soft: true })
  })
  it('an enrolled user never sees either', () => {
    expect(mfaSignals({ mfa_enabled: true, mfa_setup_required: true, mfa_enrollment_blocked: true })).toEqual({ hard: false, soft: false })
  })
})
