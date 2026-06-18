import { describe, it, expect } from 'vitest'
import { hasModule, tenantModules } from './modules'

describe('tenantModules', () => {
  it('derives modules from the tenant package', () => {
    expect(tenantModules({ package: 'reporting_sm' })).toEqual(['sm'])
    expect(tenantModules({ package: 'ats_crm_ai_planning' })).toEqual(['ats', 'ai', 'plan'])
  })

  it('prefers an explicit modules array (strings or {key}/{name} objects)', () => {
    expect(tenantModules({ package: 'ats_crm', modules: ['sm', 'hf'] })).toEqual(['sm', 'hf'])
    expect(tenantModules({ modules: [{ key: 'sm' }, { name: 'ai' }] })).toEqual(['sm', 'ai'])
  })

  it('supports legacy package ids', () => {
    expect(tenantModules({ package: 'reporting_shiftmanager' })).toEqual(['sm'])
    expect(tenantModules({ package: 'connect' })).toEqual(expect.arrayContaining(['sm', 'hf', 'ai', 'ats', 'plan']))
  })

  it('returns [] for unknown or missing input', () => {
    expect(tenantModules(null)).toEqual([])
    expect(tenantModules({ package: 'does_not_exist' })).toEqual([])
  })
})

describe('hasModule', () => {
  it('is true when the tenant has the module', () => {
    expect(hasModule('sm', { package: 'reporting_sm' })).toBe(true)
  })

  it('is false when the tenant lacks the module', () => {
    expect(hasModule('sm', { package: 'ats_crm' })).toBe(false)
  })

  it('lets super admins through regardless of package', () => {
    expect(hasModule('sm', { package: 'ats_crm' }, { isSuperAdmin: true })).toBe(true)
  })

  it('is false for an empty key', () => {
    expect(hasModule('', { package: 'connect' })).toBe(false)
  })
})
