/**
 * hashQuery — read and clear the query string of this hash-routed SPA's location
 * (`#page?key=value`). G-009: the mailbox OAuth callback lands as `#…?email_oauth=…`.
 */
import { setHashParam } from '@/lib/hashParams'

// Pure: read the hash query string (the app is hash-routed, never window.location.search).
export function getHashParams(hash: string): URLSearchParams {
  const raw = hash.replace(/^#/, '')
  const qIdx = raw.indexOf('?')
  return new URLSearchParams(qIdx === -1 ? '' : raw.slice(qIdx + 1))
}

// The params the BE's mailbox OAuth callback appends; all are stripped once consumed.
export const OAUTH_CALLBACK_PARAMS = ['email_oauth', 'context', 'email', 'request_id', 'reason'] as const

// Pure: the callback reason codes the BE sends, as the suffix of the i18n key (`oauthReason<Suffix>`).
const OAUTH_REASON_SUFFIX: Record<string, string> = {
  browser_mismatch: 'BrowserMismatch',
  provider_denied: 'ProviderDenied',
  token_exchange_failed: 'TokenExchangeFailed',
  state_invalid: 'StateInvalid',
}

// Pure: i18n key suffix for a reason code, or null for an unknown/absent code (caller shows its generic text).
export function oauthReasonKey(code: string | null): string | null {
  return code ? OAUTH_REASON_SUFFIX[code] ?? null : null
}

// Remove the OAuth callback params from the current URL so a refresh never replays the result.
export function stripOauthParams(): void {
  let next = window.location.hash
  for (const key of OAUTH_CALLBACK_PARAMS) next = setHashParam(next, key, null)
  window.history.replaceState(null, '', window.location.pathname + window.location.search + next)
}
