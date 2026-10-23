/**
 * authNotice — one-shot success notice handed from a public auth page to the login page
 * (password reset / invitation accepted). Storage access is wrapped: it may be blocked.
 */
export const AUTH_NOTICE_KEY = 'km_auth_notice'

export type AuthNoticeKind = 'password_reset' | 'invite_accepted'

// Remember which notice the login page should show next.
export function setAuthNotice(kind: AuthNoticeKind): void {
  try { sessionStorage.setItem(AUTH_NOTICE_KEY, kind) } catch { /* storage blocked: notice is optional */ }
}

// Read the pending notice; unknown or unreadable values count as none.
export function readAuthNotice(): AuthNoticeKind | null {
  try {
    const v = sessionStorage.getItem(AUTH_NOTICE_KEY)
    return v === 'password_reset' || v === 'invite_accepted' ? v : null
  } catch { return null }
}

// Drop the pending notice once it has been shown.
export function clearAuthNotice(): void {
  try { sessionStorage.removeItem(AUTH_NOTICE_KEY) } catch { /* storage blocked */ }
}
