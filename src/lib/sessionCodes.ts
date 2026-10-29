/**
 * sessionCodes — helpers for the ONIX C-005 / C-008 / C-002 session codes (BE lane G
 * c5bf84fb). A 401 `{code: 'session_revoked'}` means a credential event (e-mail change,
 * MFA change, platform revoke, log-out-elsewhere) ended this browser session; a 401
 * `{code: 'session_expired'}` is the absolute session age; a 401 `{code:
 * 'mfa_challenge_used'}` on the MFA verify means the login challenge was already redeemed.
 */

// The error codes the API returns for an ended session and a spent MFA challenge.
export const SESSION_REVOKED_CODE    = 'session_revoked'
export const MFA_CHALLENGE_USED_CODE = 'mfa_challenge_used'
// The session flag the login screen reads to explain that the session was revoked
// (set next to km_session_expired, which stays the generic "session gone" hint).
export const SESSION_REVOKED_FLAG = 'km_session_revoked'

// Minimal axios-error shape we probe — keeps this module dependency-free.
type MaybeAxiosError = {
  response?: { status?: number; data?: { code?: string } | null } | null
} | null | undefined

// The code of a 401, or null when the error is not a coded 401.
function unauthorizedCode(error: unknown): string | null {
  const response = (error as MaybeAxiosError)?.response
  return response?.status === 401 ? (response?.data?.code ?? null) : null
}

/** True when a 401 says a credential event revoked this session. */
export function isSessionRevokedError(error: unknown): boolean {
  return unauthorizedCode(error) === SESSION_REVOKED_CODE
}

/** True when a 401 on the MFA verify says the login challenge was already redeemed. */
export function isMfaChallengeUsedError(error: unknown): boolean {
  return unauthorizedCode(error) === MFA_CHALLENGE_USED_CODE
}
