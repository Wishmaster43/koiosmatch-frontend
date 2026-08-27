/**
 * passesModuleOrApp — SM-MODULE-TABS-1 gating matrix for the settings nav item
 * itself (mod_shiftmanager): visible on module-only, app-only, both, or hidden on
 * neither. Imported from SettingsPage.jsx (kept there since it is the shell's own
 * gate, mirroring lib/access.ts's `canAccessPage`).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { passesModuleOrApp, parseHash } from './SettingsPage'

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

// SLUG-MIGRATIE-1: old Dutch settings section ids resolve via SLUG_ALIASES to their
// renamed English slug, so bookmarked/shared deep links keep working after the rename.
describe('parseHash — SLUG_ALIASES resolves renamed Dutch slugs to their English id', () => {
  afterEach(() => {
    window.location.hash = ''
  })

  it('old import_export/importeren resolves to import_export/import', () => {
    window.location.hash = '#settings/import_export/importeren'
    expect(parseHash()).toEqual({ category: 'import_export', tab: 'import' })
  })

  it('old communication email contexts resolve to their English ids', () => {
    window.location.hash = '#settings/communication/email_klanten'
    expect(parseHash()).toEqual({ category: 'communication', tab: 'email_customers' })
    window.location.hash = '#settings/communication/email_kandidaten'
    expect(parseHash()).toEqual({ category: 'communication', tab: 'email_candidates' })
  })

  it('old notification contexts resolve to their English ids', () => {
    window.location.hash = '#settings/notifications/notif_sollicitaties'
    expect(parseHash()).toEqual({ category: 'notifications', tab: 'notif_applications' })
    window.location.hash = '#settings/notifications/notif_vacatures'
    expect(parseHash()).toEqual({ category: 'notifications', tab: 'notif_vacancies' })
    window.location.hash = '#settings/notifications/notif_kandidaten'
    expect(parseHash()).toEqual({ category: 'notifications', tab: 'notif_candidates' })
    window.location.hash = '#settings/notifications/notif_klanten'
    expect(parseHash()).toEqual({ category: 'notifications', tab: 'notif_customers' })
    window.location.hash = '#settings/notifications/notif_taken'
    expect(parseHash()).toEqual({ category: 'notifications', tab: 'notif_tasks' })
    window.location.hash = '#settings/notifications/notif_facturering'
    expect(parseHash()).toEqual({ category: 'notifications', tab: 'notif_billing' })
  })

  it('a new-style hash with no alias passes through unchanged', () => {
    window.location.hash = '#settings/candidate/functions'
    expect(parseHash()).toEqual({ category: 'candidate', tab: 'functions' })
  })
})
