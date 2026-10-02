/**
 * Pure role/permission/module checks for AuthContext (UI gating only — NOT
 * security; the backend re-validates everything, see AuthContext.tsx header).
 * Extracted so each check is independently testable without mounting the
 * provider; AuthContext wraps these in useCallback for its stable identities.
 */
import { hasModule as tenantHasModule } from '@/lib/modules'
import type { Tenant, User } from '@/types/api'

// The auth user, plus the flat tenant_id the backend includes on the profile.
export type AuthUser = User & { tenant_id?: string | number | null }

// Decides whether we may call the super-admin-only /tenants endpoint.
export const userIsSuperAdmin = (u?: AuthUser | null): boolean => u?.is_super_admin === true

// True when the user holds the named role (roles may be plain strings or role objects).
export const checkHasRole = (user: AuthUser | null, role: string): boolean =>
  user?.roles?.some(r => (typeof r === 'string' ? r : r.name) === role) ?? false

// True for any of the admin-ish roles; built from checkHasRole so the role list stays the single source.
export const checkIsAdmin = (user: AuthUser | null): boolean =>
  checkHasRole(user, 'admin') || checkHasRole(user, 'tenant_admin') || checkHasRole(user, 'super_admin')

// Super admin = the explicit `is_super_admin` flag (always on /auth/me and the login
// payload since BE ONIX C-003 51bc7f3c) or the super_admin role. NEVER "a profile
// without a tenant": that proxy was the C-003 finding (an orphaned account is not a
// platform admin; the server now refuses it with 403 no_organisation, see
// lib/orphanAccount). A profile that omits the flag is a tenant user.
export const checkIsSuperAdmin = (user: AuthUser | null): boolean =>
  user?.is_super_admin === true || checkHasRole(user, 'super_admin')

// Capability check for paid add-on modules ('sm', 'hf', 'ai', 'ats', 'plan').
// Module gating is uniform: an off module is unprovisioned for the tenant, so it stays
// hidden for EVERYONE incl. super-admins (Danny 2026-07-02) — mirrors lib/access.ts. The
// server still 403s the endpoints. No isSuperAdmin bypass here on purpose.
export const checkHasModule = (activeTenant: Tenant | null, user: AuthUser | null, key: string): boolean =>
  tenantHasModule(key, activeTenant ?? user?.tenant)

// Pulls the dashboard_type off every role a (possibly multi-role) user holds (C-35).
// Pure extraction only — the caller resolves the richest-wins precedence via the
// dashboard entity's own resolveDashboardType (cross-entity import stays in
// AuthContext.tsx, never here — §2 barrel decision). Still tolerant of the legacy
// string[] shape defensively (untrusted client, §7).
export const extractDashboardTypes = (user: AuthUser | null): string[] =>
  (user?.roles ?? [])
    .map(r => (typeof r === 'object' ? r.dashboard_type : undefined))
    .filter((t): t is string => !!t)

// Checks the user's own permissions, then any role's permissions, then the sync/refresh
// fallback for tenant_admin/planner. `isSuperAdmin` is injected so this stays pure (no
// re-derivation of the super-admin rule here — checkIsSuperAdmin is the single source).
export const checkHasPermission = (
  user: AuthUser | null,
  permName: string,
  isSuperAdmin: boolean,
): boolean => {
  if (!user) return false
  if (isSuperAdmin) return true

  // A "*" entry is the backend's wildcard (/auth/me hands it to super admins since 21-09):
  // it grants every permission, so the name match accepts it next to the exact name.
  const grants = (p: string | { name: string }) => { const n = typeof p === 'string' ? p : p.name; return n === '*' || n === permName }

  if (Array.isArray(user.permissions)) {
    return user.permissions.some(grants)
  }

  const roles = user.roles ?? []
  for (const r of roles) {
    if (typeof r === 'object' && Array.isArray(r.permissions)) {
      if (r.permissions.some(grants)) return true
    }
  }

  if (permName.endsWith('.sync') || permName.endsWith('.refresh')) {
    return checkHasRole(user, 'tenant_admin') || checkHasRole(user, 'planner')
  }
  return false
}
