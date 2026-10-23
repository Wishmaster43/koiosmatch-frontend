/**
 * tenantResolution — helpers for the ONIX B-003 bureau-resolution codes (BE lane G
 * c5bf84fb, Danny 4a = A: no first-bureau fallback). A super admin request on a bureau
 * route without an explicit bureau is refused `400 {code: 'tenant_required'}`; a stale
 * X-Tenant that names a deleted bureau is refused `404 {code: 'tenant_not_found'}` on
 * every bureau route and the bell. Both mean: pick a bureau, then resend with X-Tenant.
 */

// The error codes the API returns when the bureau could not be resolved.
export const TENANT_REQUIRED_CODE  = 'tenant_required'
export const TENANT_NOT_FOUND_CODE = 'tenant_not_found'
// 409 from BE lane F (B-002): the named bureau is still provisioning or its provisioning failed.
export const TENANT_NOT_READY_CODE = 'tenant_not_ready'
// Session key that carries the refusal code from api.ts to the picker wall (set once per boot).
export const TENANT_PICK_CODE_KEY = 'km_tenant_pick_code'
// The DOM event api.ts dispatches once per boot so AuthContext can raise the picker wall.
export const TENANT_REQUIRED_EVENT = 'km:tenant-required'
// The session flag that keeps the event to one dispatch per boot (cleared on a pick).
export const TENANT_PICK_FLAG = 'km_tenant_pick'

// Minimal axios-error shape we probe — keeps this module dependency-free.
type MaybeAxiosError = {
  response?: { status?: number; data?: { code?: string } | null } | null
} | null | undefined

/** The bureau-resolution code of a failed request, or null when it is not one. */
export function tenantResolutionCode(error: unknown): typeof TENANT_REQUIRED_CODE | typeof TENANT_NOT_FOUND_CODE | typeof TENANT_NOT_READY_CODE | null {
  const response = (error as MaybeAxiosError)?.response
  const code = response?.data?.code
  if (response?.status === 400 && code === TENANT_REQUIRED_CODE) return TENANT_REQUIRED_CODE
  if (response?.status === 404 && code === TENANT_NOT_FOUND_CODE) return TENANT_NOT_FOUND_CODE
  if (response?.status === 409 && code === TENANT_NOT_READY_CODE) return TENANT_NOT_READY_CODE
  return null
}

/** True when a request failed because no valid bureau was named for a super admin. */
export function isTenantResolutionError(error: unknown): boolean {
  return tenantResolutionCode(error) !== null
}
