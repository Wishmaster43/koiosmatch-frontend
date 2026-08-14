/**
 * Reports settings menu ("report_kpis") module gate — mirrors the existing
 * 'planning' group exactly (RAPPORT-KPI-INSTELBAAR): hidden entirely without the
 * reports module, visible with it. Uses the SAME filter the settings shell
 * itself applies (`canAccessPage`), so this test fails the day the gate drifts
 * from the shell's own logic.
 */
import { describe, it, expect } from 'vitest'
import { NAV_GROUPS } from './registry'
import { canAccessPage } from '@/lib/access'

// Mirrors SettingsPage.jsx's `visibleGroups` memo.
function visibleGroups(auth) {
  return NAV_GROUPS
    .map(group => ({ ...group, items: group.items.filter(it => !it.requiresPage || canAccessPage(it.requiresPage, auth)) }))
    .filter(group => group.items.length > 0)
}

describe('Settings → Reports group ("report_kpis") — module gate', () => {
  it('has requiresPage: reports on its item, mirroring the planning group pattern', () => {
    const group = NAV_GROUPS.find(g => g.key === 'reports')
    expect(group).toBeTruthy()
    const item = group.items.find(it => it.id === 'report_kpis')
    expect(item).toBeTruthy()
    expect(item.requiresPage).toBe('reports')
  })

  it('is hidden when the tenant has no reports module', () => {
    const auth = { activeTenant: { modules: [] }, user: { tenant: { modules: [] } } }
    const groups = visibleGroups(auth)
    expect(groups.find(g => g.key === 'reports')).toBeUndefined()
  })

  it('is visible when the tenant has the reports module', () => {
    const auth = { activeTenant: { modules: ['reports'] }, user: { tenant: { modules: ['reports'] } } }
    const groups = visibleGroups(auth)
    const group = groups.find(g => g.key === 'reports')
    expect(group).toBeTruthy()
    expect(group.items.some(it => it.id === 'report_kpis')).toBe(true)
  })
})
