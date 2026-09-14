/**
 * K-195 — the whatsapp_web settings item must gate on both the module
 * (whatsapp_web, tenants without the module never see the sub-tab) and the
 * settings.view permission, matching the backend's module:whatsapp_web route
 * group (§3 — a screen without the right stays HIDDEN, never just disabled).
 */
import { describe, it, expect } from 'vitest'
import { NAV_GROUPS } from './registry'

describe('registry — whatsapp_web module + permission gate', () => {
  it('whatsapp_web declares requiresModuleOrApp: whatsapp_web and requiresPermission: settings.view', () => {
    const whatsappGroup = NAV_GROUPS.find((g) => g.key === 'whatsapp')
    const item = whatsappGroup?.items.find((i) => i.id === 'whatsapp_web')
    expect(item?.requiresModuleOrApp).toEqual({ module: 'whatsapp_web' })
    expect(item?.requiresPermission).toBe('settings.view')
    expect(item?.component).toBeDefined()
  })
})
