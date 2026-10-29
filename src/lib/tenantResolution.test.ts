import { describe, it, expect } from 'vitest'
import { isTenantResolutionError, tenantResolutionCode, resolveStoredTenant, clearTenantPickSignal } from './tenantResolution'

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

// B-003 / B-002 pure rule: pin, pick, keep the stored id, or change nothing.
describe('resolveStoredTenant + clearTenantPickSignal', () => {
  const t1 = { id: 't1', name: 'One' } as never
  it('pins a listed ready id, picks for stale/missing/blocked, keeps on a failed list, no-ops on empty', () => {
    expect(resolveStoredTenant([t1], 't1')).toEqual({ kind: 'pinned', tenant: t1 })
    expect(resolveStoredTenant([t1], 'gone')).toEqual({ kind: 'pick' })
    expect(resolveStoredTenant([t1], null)).toEqual({ kind: 'pick' })
    expect(resolveStoredTenant(null, 't1')).toEqual({ kind: 'keepStored', id: 't1' })
    expect(resolveStoredTenant(null, null)).toEqual({ kind: 'pick' })
    expect(resolveStoredTenant([], 't1')).toEqual({ kind: 'none' })
    for (const provisioning_status of ['pending', 'failed']) {
      expect(resolveStoredTenant([{ id: 't1', provisioning_status } as never], 't1')).toEqual({ kind: 'pick' })
    }
    expect(resolveStoredTenant([{ id: 't1', provisioning_status: 'ready' } as never], 't1').kind).toBe('pinned')
  })

  it('clearTenantPickSignal drops both session keys', () => {
    sessionStorage.setItem('km_tenant_pick', '1')
    sessionStorage.setItem('km_tenant_pick_code', 'tenant_required')
    clearTenantPickSignal()
    expect(sessionStorage.getItem('km_tenant_pick')).toBeNull()
    expect(sessionStorage.getItem('km_tenant_pick_code')).toBeNull()
  })
})
