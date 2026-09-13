/**
 * Pure shaping helpers for /auth/me and login-style responses. Extracted from
 * AuthContext's applyAuthResponse so the tenant-stamping rule is independently
 * testable without mounting the provider or touching localStorage.
 */
import type { Tenant } from '@/types/api'
import type { AuthUser } from './permissions'

export interface ShapedAuthResponse {
  user: AuthUser
  accessiblePages: string[]
  tenant: Tenant | null
}

// SUPERADMIN-FALLBACK-1 (04-09, measured as the readonly demo user): /auth/me
// carries the tenant as a SIBLING of `user`, never as user.tenant_id, so the
// "user without a tenant" heuristic in isSuperAdmin() fired for every tenant
// user and opened every permission gate. Stamp the sibling tenant onto the
// stored profile so the profile itself says which tenant it belongs to.
export const stampTenantOnUser = (raw: AuthUser, sibling: Tenant | undefined): AuthUser =>
  raw && sibling?.id && raw.tenant_id == null && !raw.tenant ? { ...raw, tenant_id: sibling.id } : raw

// Extracts the user, accessible pages and active tenant from a raw /auth/me
// or login response body — the response may nest the user under `user`,
// `data`, or (older shape) be the user itself.
export function shapeAuthResponse(data: unknown): ShapedAuthResponse {
  const d = data as { user?: AuthUser; data?: AuthUser; accessible_pages?: string[]; tenant?: Tenant } | null | undefined
  const raw = (d?.user ?? d?.data ?? data) as AuthUser
  const user = stampTenantOnUser(raw, d?.tenant)
  const accessiblePages = d?.accessible_pages ?? user?.accessible_pages ?? []
  const tenant = d?.tenant ?? user?.tenant ?? null
  return { user, accessiblePages, tenant }
}
