/**
 * passesModuleOrApp — SM-MODULE-TABS-1 gating matrix for the settings nav item
 * itself (mod_shiftmanager): visible on module-only, app-only, both, or hidden on
 * neither. Imported from SettingsPage.jsx (kept there since it is the shell's own
 * gate, mirroring lib/access.ts's `canAccessPage`).
 */
import { describe, it, expect } from 'vitest'
import { passesModuleOrApp } from './SettingsPage'

const gate = { module: 'sm', app: 'shiftmanager' }

describe('passesModuleOrApp — module/app OR-gate', () => {
  it('no requirement at all → always visible', () => {
    expect(passesModuleOrApp(null, { hasModule: () => false, isAppEnabled: () => false })).toBe(true)
  })

  it('module only → visible', () => {
    const hasModule = (k) => k === 'sm'
    const isAppEnabled = () => false
    expect(passesModuleOrApp(gate, { hasModule, isAppEnabled })).toBe(true)
  })

  it('app only → visible', () => {
    const hasModule = () => false
    const isAppEnabled = (k) => k === 'shiftmanager'
    expect(passesModuleOrApp(gate, { hasModule, isAppEnabled })).toBe(true)
  })

  it('both on → visible', () => {
    expect(passesModuleOrApp(gate, { hasModule: () => true, isAppEnabled: () => true })).toBe(true)
  })

  it('neither on → hidden', () => {
    expect(passesModuleOrApp(gate, { hasModule: () => false, isAppEnabled: () => false })).toBe(false)
  })

  it('missing isAppEnabled (AppsContext not mounted yet) never throws — treated as app off', () => {
    expect(passesModuleOrApp(gate, { hasModule: () => false, isAppEnabled: undefined })).toBe(false)
    expect(passesModuleOrApp(gate, { hasModule: () => true, isAppEnabled: undefined })).toBe(true)
  })
})
