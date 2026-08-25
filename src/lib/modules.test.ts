/**
 * modules — regression coverage for K-193: the enterprise package must grant
 * whatsapp_web (personal WhatsApp Web devices) alongside the existing
 * tenant-wide whatsapp (WABA) module.
 */
import { describe, it, expect } from 'vitest'
import { tenantModules, hasModule } from './modules'

describe('modules — K-193 whatsapp_web', () => {
  it('enterprise package grants whatsapp_web', () => {
    const modules = tenantModules({ package: 'enterprise' } as never)
    expect(modules).toContain('whatsapp_web')
    expect(modules).toContain('whatsapp')
  })

  it('hasModule reports whatsapp_web for an enterprise tenant', () => {
    expect(hasModule('whatsapp_web', { package: 'enterprise' } as never)).toBe(true)
  })

  it('core package does not grant whatsapp_web', () => {
    expect(hasModule('whatsapp_web', { package: 'core' } as never)).toBe(false)
  })

  it('an explicit tenant.modules array without whatsapp_web does not grant it', () => {
    expect(hasModule('whatsapp_web', { modules: ['ats', 'whatsapp'] } as never)).toBe(false)
  })
})
