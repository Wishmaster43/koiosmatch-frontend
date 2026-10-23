import { describe, it, expect } from 'vitest'
import { isTenantResolutionError, tenantResolutionCode } from './tenantResolution'

// ONIX B-003 (BE c5bf84fb): only the two coded refusals count as "pick a bureau".
describe('tenantResolution', () => {
  it('recognises 400 tenant_required and 404 tenant_not_found by status AND code', () => {
    expect(tenantResolutionCode({ response: { status: 400, data: { code: 'tenant_required' } } })).toBe('tenant_required')
    expect(tenantResolutionCode({ response: { status: 404, data: { code: 'tenant_not_found' } } })).toBe('tenant_not_found')
    expect(isTenantResolutionError({ response: { status: 400, data: { code: 'tenant_required' } } })).toBe(true)
  })

  it('ignores a plain 404, a 400 without the code, a code on the wrong status and non-errors', () => {
    expect(isTenantResolutionError({ response: { status: 404, data: { message: 'Not found' } } })).toBe(false)
    expect(isTenantResolutionError({ response: { status: 400, data: { code: 'validation' } } })).toBe(false)
    expect(isTenantResolutionError({ response: { status: 404, data: { code: 'tenant_required' } } })).toBe(false)
    expect(isTenantResolutionError(null)).toBe(false)
    expect(isTenantResolutionError(new Error('network'))).toBe(false)
  })
})

// BE lane F B-002: a bureau still provisioning (or failed) answers 409 tenant_not_ready.
describe('tenantResolution tenant_not_ready', () => {
  it('recognises 409 tenant_not_ready and ignores a plain 409', () => {
    expect(tenantResolutionCode({ response: { status: 409, data: { code: 'tenant_not_ready' } } })).toBe('tenant_not_ready')
    expect(isTenantResolutionError({ response: { status: 409, data: { code: 'tenant_not_ready' } } })).toBe(true)
    expect(tenantResolutionCode({ response: { status: 409, data: { code: 'in_use' } } })).toBeNull()
    expect(tenantResolutionCode({ response: { status: 400, data: { code: 'tenant_not_ready' } } })).toBeNull()
  })
})
