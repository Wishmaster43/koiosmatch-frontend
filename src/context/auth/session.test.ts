import { describe, it, expect } from 'vitest'
import { stampTenantOnUser, shapeAuthResponse } from './session'
import type { AuthUser } from './permissions'

describe('stampTenantOnUser', () => {
  it('stamps the sibling tenant id when the user carries none', () => {
    const raw = { id: 'u1' } as AuthUser
    const stamped = stampTenantOnUser(raw, { id: 't1', name: 'Demo' } as never)
    expect(stamped.tenant_id).toBe('t1')
  })
  it('leaves the user untouched when it already has a tenant object', () => {
    const raw = { id: 'u1', tenant: { id: 't2' } } as unknown as AuthUser
    const stamped = stampTenantOnUser(raw, { id: 't1', name: 'Demo' } as never)
    expect(stamped).toBe(raw)
  })
  it('leaves the user untouched when tenant_id is already set', () => {
    const raw = { id: 'u1', tenant_id: 't3' } as AuthUser
    const stamped = stampTenantOnUser(raw, { id: 't1', name: 'Demo' } as never)
    expect(stamped.tenant_id).toBe('t3')
  })
})

describe('shapeAuthResponse', () => {
  it('reads user + accessible_pages + tenant from a nested /auth/me body', () => {
    const { user, accessiblePages, tenant } = shapeAuthResponse({
      user: { id: 'u1' },
      accessible_pages: ['candidates'],
      tenant: { id: 't1', name: 'Demo' },
    })
    expect(user.id).toBe('u1')
    expect(user.tenant_id).toBe('t1')
    expect(accessiblePages).toEqual(['candidates'])
    expect(tenant?.id).toBe('t1')
  })
  it('falls back to a bare user body with no wrapper', () => {
    const { user, accessiblePages, tenant } = shapeAuthResponse({ id: 'u2' })
    expect(user.id).toBe('u2')
    expect(accessiblePages).toEqual([])
    expect(tenant).toBeNull()
  })
})
