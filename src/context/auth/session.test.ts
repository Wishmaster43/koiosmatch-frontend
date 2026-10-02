import { describe, it, expect } from 'vitest'
import { shapeAuthResponse } from './session'

describe('shapeAuthResponse', () => {
  it('reads user + accessible_pages + tenant from a nested /auth/me body', () => {
    const { user, accessiblePages, tenant } = shapeAuthResponse({
      user: { id: 'u1' },
      accessible_pages: ['candidates'],
      tenant: { id: 't1', name: 'Demo' },
    })
    expect(user.id).toBe('u1')
    // ONIX C-003: the profile travels untouched — no tenant id is stamped onto it.
    expect(user).toEqual({ id: 'u1' })
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
