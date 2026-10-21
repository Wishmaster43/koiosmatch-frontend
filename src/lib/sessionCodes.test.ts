import { describe, it, expect } from 'vitest'
import { isMfaChallengeUsedError, isSessionRevokedError } from './sessionCodes'

// ONIX C-005 / C-002 (BE c5bf84fb): the codes ride on a 401 only.
describe('sessionCodes', () => {
  it('recognises the revoked and challenge-used codes on a 401', () => {
    expect(isSessionRevokedError({ response: { status: 401, data: { code: 'session_revoked' } } })).toBe(true)
    expect(isMfaChallengeUsedError({ response: { status: 401, data: { code: 'mfa_challenge_used' } } })).toBe(true)
  })

  it('ignores a bare 401, the other code, a code on another status and non-errors', () => {
    expect(isSessionRevokedError({ response: { status: 401 } })).toBe(false)
    expect(isSessionRevokedError({ response: { status: 401, data: { code: 'session_expired' } } })).toBe(false)
    expect(isSessionRevokedError({ response: { status: 403, data: { code: 'session_revoked' } } })).toBe(false)
    expect(isMfaChallengeUsedError({ response: { status: 422, data: { code: 'mfa_challenge_used' } } })).toBe(false)
    expect(isMfaChallengeUsedError(undefined)).toBe(false)
  })
})
