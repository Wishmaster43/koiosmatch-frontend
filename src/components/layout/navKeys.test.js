// navKeys — every sidebar id resolves to a common.nav.* label in all seven locales, and the registry carries no label of its own.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { REPORT_IDS } from '@/pages/reports/shared'

const LOCALES = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pt']
// The registry block of Sidebar.tsx (NAV_ITEMS + MODULE_NAV_ITEMS), read as source: the arrays are module-private.
const src = readFileSync('src/components/layout/Sidebar.tsx', 'utf8')
const registry = src.slice(src.indexOf('const NAV_ITEMS'), src.indexOf('interface SubNavItemProps'))
const ids = [...registry.matchAll(/\bid: '([a-z.-]+)'/g)].map(m => m[1])

describe('sidebar nav registry', () => {
  it('finds the registry ids (guards the source slice itself)', () => {
    expect(ids).toContain('dashboard')
    expect(ids).toContain('helloflex.dashboard')
  })

  it('carries no label property (common.nav.* is the only source)', () => {
    expect(registry).not.toMatch(/\blabel:/)
  })

  it('has a nav.<id> key in every locale for every item and report id', () => {
    const all = [...ids, ...REPORT_IDS.map(id => `reports.${id}`)]
    const missing = []
    for (const loc of LOCALES) {
      const nav = JSON.parse(readFileSync(`src/i18n/locales/${loc}/common.json`, 'utf8')).nav ?? {}
      for (const id of all) if (typeof nav[id.replace(/\./g, '_')] !== 'string') missing.push(`${loc}:${id}`)
    }
    expect(missing).toEqual([])
  })
})
