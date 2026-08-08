/**
 * rolesTypes — shared types for the roles/rights screen (RolesSettings,
 * RoleDetail, RoleBranchTemplate). Split out so the three components can share
 * one Role shape + request-body types without a circular component import.
 */
import type { operations } from '@/types/api-generated'
import type { Permission } from './RolesPermissionMatrix'

// Hand-written — GET /roles and GET /roles/{id} carry no 2xx schema in
// api-generated.ts yet (§10: only the 401 shape is documented for these routes).
export interface Role {
  id: number | string
  name: string
  guard_name?: string
  dashboard_type?: string | null
  color?: string | null
  icon?: string | null
  users_count?: number
  permissions?: Permission[]
}

export type PermissionsByGroup = Record<string, Permission[]>

// Request bodies typed from the generated spec (§10 type-gen adoption) — a
// backend field rename on any of these four routes surfaces as a compile
// error here instead of a silent runtime 422.
export type UpdateRoleBody        = NonNullable<operations['putRolesRoleId']['requestBody']>['content']['application/json']
export type UpdatePermissionsBody = NonNullable<operations['putRolesRoleIdPermissions']['requestBody']>['content']['application/json']
export type UpdateBranchesBody    = NonNullable<operations['putRolesIdBranches']['requestBody']>['content']['application/json']
export type CreateRoleBody        = operations['postRoles']['requestBody']['content']['application/json']
