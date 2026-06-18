import { describe, it, expect } from 'vitest'
import { canAccessPage } from './access'

describe('canAccessPage — module gating', () => {
  it('lets super admins open everything', () => {
    expect(canAccessPage('shiftmanager', { user: { is_super_admin: true } })).toBe(true)
  })

  it('blocks SM pages without the sm module', () => {
    expect(canAccessPage('shiftmanager', { user: {}, activeTenant: { package: 'ats_crm' } })).toBe(false)
  })

  it('allows SM pages when the package grants the sm module', () => {
    const auth = { user: {}, activeTenant: { package: 'reporting_sm' }, accessiblePages: ['shiftmanager'] }
    expect(canAccessPage('shiftmanager', auth)).toBe(true)
  })

  it('blocks HelloFlex without the hf module', () => {
    expect(canAccessPage('helloflex', { user: {}, activeTenant: { package: 'reporting_sm' } })).toBe(false)
  })
})

describe('canAccessPage — standard ATS pages', () => {
  it('allows candidates on an ats_crm package', () => {
    expect(canAccessPage('candidates', { user: {}, activeTenant: { package: 'ats_crm' } })).toBe(true)
  })

  it('respects page.* permission whitelists on restrictable pages', () => {
    const auth = {
      user: { permissions: ['page.customers'] },
      activeTenant: { package: 'ats_crm' },
    }
    // user has an explicit page-whitelist that does NOT include candidates
    expect(canAccessPage('candidates', auth)).toBe(false)
    expect(canAccessPage('customers', auth)).toBe(true)
  })
})
