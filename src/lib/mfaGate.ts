/**
 * mfaGate — helpers for tenant-wide MFA enforcement (B-23).
 * When the tenant enforces MFA and the user has no second factor, the API rejects
 * every call except /auth/me, /auth/logout and /auth/mfa/setup|confirm with a
 * 403 whose body carries { code: 'mfa_enrollment_required' }. The gate checks the
 * error code, not settings keys (which are now access-gated and unavailable to
 * callers without billing.view).
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

// MFA-GATE-SPLIT-1 (definitive, CMBE 08-09): the hard wall is mfa_enrollment_blocked
// (the server's blocksUser(), absent until BE bouwgolf 2 = never a wall); the soft
// nudge is mfa_setup_required (the policy wants this role enrolled). Enrolled = neither.
export function mfaSignals(user: { mfa_enabled?: boolean; mfa_setup_required?: boolean; mfa_enrollment_blocked?: boolean } | null | undefined): { hard: boolean; soft: boolean } {
  if (!user || user.mfa_enabled === true) return { hard: false, soft: false }
  return { hard: user.mfa_enrollment_blocked === true, soft: user.mfa_setup_required === true }
}
