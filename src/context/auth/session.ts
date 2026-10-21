/**
 * Pure shaping helpers for /auth/me and login-style responses. Extracted from
 * AuthContext's applyAuthResponse so the tenant-stamping rule is independently
 * testable without mounting the provider or touching localStorage.
 */
import type { Tenant } from '@/types/api'
import type { UploadPolicy } from '@/lib/uploadPolicy'
import type { AuthUser } from './permissions'

export interface ShapedAuthResponse {
  user: AuthUser
  accessiblePages: string[]
  tenant: Tenant | null
  // UPLOAD-POLICY-1 (BE lane F, lands with M1): the per-surface upload policy, a ROOT key
  // next to user/tenant; null until the server sends it (the FE seed applies then).
  uploads: UploadPolicy | null
}

// Extracts the user, accessible pages and active tenant from a raw /auth/me
// or login response body — the response may nest the user under `user`,
// `data`, or (older shape) be the user itself.
export function shapeAuthResponse(data: unknown): ShapedAuthResponse {
  const d = data as { user?: AuthUser; data?: AuthUser; accessible_pages?: string[]; tenant?: Tenant; uploads?: UploadPolicy | null } | null | undefined
  // The profile travels as is: super admin is the explicit is_super_admin flag
  // (ONIX C-003), so no tenant id needs stamping onto the user any more.
  const user = (d?.user ?? d?.data ?? data) as AuthUser
  const accessiblePages = d?.accessible_pages ?? user?.accessible_pages ?? []
  const tenant = d?.tenant ?? user?.tenant ?? null
  // Only an object counts as a policy; a bare user body or an older server has none.
  const uploads = d?.uploads && typeof d.uploads === 'object' ? d.uploads : null
  return { user, accessiblePages, tenant, uploads }
}
