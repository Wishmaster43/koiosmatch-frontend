import { describe, it, expect } from 'vitest'
import { isTenantBlocked } from './tenantProvisioning'

describe('isTenantBlocked', () => {
  it('blocks pending and failed only', () => {
    expect(isTenantBlocked('pending')).toBe(true)
    expect(isTenantBlocked('failed')).toBe(true)
    expect(isTenantBlocked('ready')).toBe(false)
    expect(isTenantBlocked(null)).toBe(false)
    expect(isTenantBlocked(undefined)).toBe(false)
  })
})
