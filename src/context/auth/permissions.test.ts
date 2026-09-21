import { describe, it, expect } from 'vitest'
import {
  userIsSuperAdmin, checkHasRole, checkIsAdmin, checkIsSuperAdmin,
  checkHasModule, extractDashboardTypes, checkHasPermission,
} from './permissions'
import type { AuthUser } from './permissions'

describe('userIsSuperAdmin', () => {
  it('is true only when the explicit flag is true', () => {
    expect(userIsSuperAdmin({ is_super_admin: true } as AuthUser)).toBe(true)
    expect(userIsSuperAdmin({ is_super_admin: false } as AuthUser)).toBe(false)
    expect(userIsSuperAdmin(null)).toBe(false)
  })
})

describe('checkHasRole', () => {
  it('matches both string and object role shapes', () => {
    expect(checkHasRole({ roles: ['admin'] } as unknown as AuthUser, 'admin')).toBe(true)
    expect(checkHasRole({ roles: [{ name: 'planner' }] } as unknown as AuthUser, 'planner')).toBe(true)
    expect(checkHasRole({ roles: [{ name: 'planner' }] } as unknown as AuthUser, 'admin')).toBe(false)
    expect(checkHasRole(null, 'admin')).toBe(false)
  })
})

describe('checkIsAdmin', () => {
  it('is true for any admin-ish role', () => {
    expect(checkIsAdmin({ roles: [{ name: 'tenant_admin' }] } as unknown as AuthUser)).toBe(true)
    expect(checkIsAdmin({ roles: [{ name: 'readonly' }] } as unknown as AuthUser)).toBe(false)
  })
})

describe('checkIsSuperAdmin', () => {
  it('fires on the explicit flag or role', () => {
    expect(checkIsSuperAdmin({ is_super_admin: true } as AuthUser)).toBe(true)
    expect(checkIsSuperAdmin({ roles: [{ name: 'super_admin' }] } as unknown as AuthUser)).toBe(true)
  })
  it('fires on an explicit tenant_id: null with no tenant object', () => {
    expect(checkIsSuperAdmin({ tenant_id: null } as AuthUser)).toBe(true)
  })
  // SUPERADMIN-FALLBACK-1: a profile that merely OMITS tenant_id is a tenant user, never platform.
  it('never fires when tenant_id is simply absent', () => {
    expect(checkIsSuperAdmin({ id: 'tom' } as AuthUser)).toBe(false)
  })
  it('never fires when tenant_id is null but a tenant object is present', () => {
    expect(checkIsSuperAdmin({ tenant_id: null, tenant: { id: 't1', name: 'Demo' } } as AuthUser)).toBe(false)
  })
})

describe('checkHasModule', () => {
  it('prefers the active tenant over the user tenant', () => {
    const activeTenant = { id: 't1', name: 'Active', modules: ['ai'] } as never
    expect(checkHasModule(activeTenant, null, 'ai')).toBe(true)
    expect(checkHasModule(activeTenant, null, 'sm')).toBe(false)
  })
})

describe('extractDashboardTypes', () => {
  it('collects every dashboard_type a multi-role user carries, in role order', () => {
    const user = {
      roles: [
        { name: 'recruiter', dashboard_type: 'recruitment' },
        { name: 'manager', dashboard_type: 'recruitment_manager' },
      ],
    } as unknown as AuthUser
    expect(extractDashboardTypes(user)).toEqual(['recruitment', 'recruitment_manager'])
  })
  it('returns an empty list with no dashboard_type at all', () => {
    expect(extractDashboardTypes({ roles: [] } as unknown as AuthUser)).toEqual([])
  })
})

describe('checkHasPermission', () => {
  // KOIOS-NAV-SUPERADMIN-1: "*" is the backend's wildcard — it grants every name, on the user and on a role.
  it('treats a "*" entry on the user as every permission', () => {
    expect(checkHasPermission({ id: 'x', permissions: ['*'] } as unknown as AuthUser, 'koios.use', false)).toBe(true)
  })
  it('treats a "*" entry on a role as every permission', () => {
    expect(checkHasPermission({ id: 'x', roles: [{ name: 'r', permissions: ['*'] }] } as unknown as AuthUser, 'users.view', false)).toBe(true)
  })
  it('still refuses an explicit list without the name and without the wildcard', () => {
    expect(checkHasPermission({ id: 'x', permissions: ['candidates.view'] } as unknown as AuthUser, 'koios.use', false)).toBe(false)
  })
  it('grants everything when isSuperAdmin is true', () => {
    expect(checkHasPermission({ id: 'x' } as AuthUser, 'anything', true)).toBe(true)
  })
  it('checks the user own permission list first', () => {
    const user = { permissions: ['tasks.view'] } as unknown as AuthUser
    expect(checkHasPermission(user, 'tasks.view', false)).toBe(true)
    expect(checkHasPermission(user, 'tasks.create', false)).toBe(false)
  })
  it('falls through to role permissions', () => {
    const user = { roles: [{ name: 'r', permissions: [{ name: 'tasks.view' }] }] } as unknown as AuthUser
    expect(checkHasPermission(user, 'tasks.view', false)).toBe(true)
  })
  it('grants .sync/.refresh to tenant_admin/planner as a fallback', () => {
    const user = { roles: [{ name: 'tenant_admin' }] } as unknown as AuthUser
    expect(checkHasPermission(user, 'lookups.sync', false)).toBe(true)
    expect(checkHasPermission(user, 'lookups.other', false)).toBe(false)
  })
  it('is false with no user', () => {
    expect(checkHasPermission(null, 'tasks.view', false)).toBe(false)
  })
})
