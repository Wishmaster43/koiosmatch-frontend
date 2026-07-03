import { describe, it, expect } from 'vitest'
import { canAccessPage } from './access'

describe('canAccessPage — module gating', () => {
  it('lets super admins open non-module-gated pages', () => {
    expect(canAccessPage('candidates', { user: { is_super_admin: true } })).toBe(true)
  })

  it('gates modules even for super admins — off module is hidden everywhere (Danny 2026-07-02)', () => {
    // No sm module → hidden even for a super admin.
    expect(canAccessPage('shiftmanager', { user: { is_super_admin: true } })).toBe(false)
    // With the sm module (via package) → visible.
    expect(canAccessPage('shiftmanager', { user: { is_super_admin: true }, activeTenant: { package: 'reporting_sm' } })).toBe(true)
  })

  it('gates whatsapp/aiagents on the granular BE module keys (package-switch works)', () => {
    // core = [ats] only → no whatsapp/aiagents, but candidates (ats) stays visible.
    const core = { user: { is_super_admin: true }, activeTenant: { modules: ['ats'] } }
    expect(canAccessPage('whatsapp', core)).toBe(false)
    expect(canAccessPage('aiagents', core)).toBe(false)
    expect(canAccessPage('candidates', core)).toBe(true)
    // pro carries whatsapp + aiagents → visible.
    const pro = { user: { is_super_admin: true }, activeTenant: { modules: ['ats', 'whatsapp', 'aiagents', 'workflows', 'koios_ai'] } }
    expect(canAccessPage('whatsapp', pro)).toBe(true)
    expect(canAccessPage('aiagents', pro)).toBe(true)
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

  it('allows opportunities on an ats_crm package but blocks it on a reporting package', () => {
    expect(canAccessPage('opportunities', { user: {}, activeTenant: { package: 'ats_crm' } })).toBe(true)
    expect(canAccessPage('opportunities', { user: {}, activeTenant: { package: 'reporting_sm' } })).toBe(false)
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
