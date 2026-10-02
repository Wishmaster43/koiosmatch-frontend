/**
 * orphanAccount — helpers for the ONIX C-003 orphan case (BE 51bc7f3c): an account
 * that belongs to no organisation and is not a super admin is refused with a 403
 * whose body carries { code: 'no_organisation' } — on login and on every request
 * with an existing token (the server revokes tokens, push and sessions). The FE
 * shows a calm "contact your administrator" notice and ends the local session.
 */

// The error code the API returns for an account without an organisation.
export const NO_ORGANISATION_CODE = 'no_organisation'
// The session flag the login screen reads to explain why the session ended.
export const NO_ORGANISATION_FLAG = 'km_no_organisation'

// Minimal axios-error shape we probe — keeps this module dependency-free.
type MaybeAxiosError = {
  response?: { status?: number; data?: { code?: string } | null } | null
} | null | undefined

/** True when a request was refused because the account hangs on no organisation. */
export function isNoOrganisationError(error: unknown): boolean {
  const response = (error as MaybeAxiosError)?.response
  return response?.status === 403 && response?.data?.code === NO_ORGANISATION_CODE
}
