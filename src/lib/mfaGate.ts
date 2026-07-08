/**
 * mfaGate — helpers for tenant-wide MFA enforcement (settings key `mfa.enforced`).
 * When enforcement is on and the user has no second factor, the API rejects every
 * call except /auth/me, /auth/logout and /auth/mfa/setup|confirm with a
 * 403 whose body carries { code: 'mfa_enrollment_required' }.
 */

// The error code the API returns on calls blocked by MFA enforcement.
export const MFA_ENROLLMENT_REQUIRED_CODE = 'mfa_enrollment_required'

// Minimal axios-error shape we probe — keeps this module dependency-free.
type MaybeAxiosError = {
  response?: { status?: number; data?: { code?: string } | null } | null
} | null | undefined

/** True when a request failed because the tenant enforces MFA and this user has not enrolled yet. */
export function isMfaEnrollmentError(error: unknown): boolean {
  const response = (error as MaybeAxiosError)?.response
  return response?.status === 403 && response?.data?.code === MFA_ENROLLMENT_REQUIRED_CODE
}
