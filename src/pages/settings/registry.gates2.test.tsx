/**
 * AF:orphans-7-5 + AF:orphans-7-6 — two registry items missing gates:
 * view_customers (Shiftmanager-only) and vacancy_generation (permission-gated).
 * Pinned to prevent silent regression.
 */
import { describe, it, expect } from 'vitest'
import { NAV_GROUPS } from './registry'

describe('registry — view_customers page gate', () => {
  it('view_customers declares requiresPage: shiftmanager', () => {
    const viewsGroup = NAV_GROUPS.find((g) => g.key === 'views')
    const item = viewsGroup?.items.find((i) => i.id === 'view_customers')
    expect(item?.requiresPage).toBe('shiftmanager')
  })
})

describe('registry: connector sections gate on the app OR the module (CONNECTOR-VS-REPORTING-1)', () => {
  it('shiftmanager declares requiresModuleOrApp { module: sm, app: shiftmanager } and no requiresPage', () => {
    const group = NAV_GROUPS.find((g) => g.key === 'integrations')
    const item = group?.items.find((i) => i.id === 'shiftmanager')
    expect(item?.requiresModuleOrApp).toEqual({ module: 'sm', app: 'shiftmanager' })
    expect(item?.requiresPage).toBeUndefined()
  })

  it('helloflex declares requiresModuleOrApp { module: hf, app: hf } and no requiresPage', () => {
    const group = NAV_GROUPS.find((g) => g.key === 'integrations')
    const item = group?.items.find((i) => i.id === 'helloflex')
    expect(item?.requiresModuleOrApp).toEqual({ module: 'hf', app: 'hf' })
    expect(item?.requiresPage).toBeUndefined()
  })
})

describe('registry — vacancy_generation permission gate', () => {
  it('vacancy_generation declares requiresPermission: vacancy_generation.manage', () => {
    const aiGroup = NAV_GROUPS.find((g) => g.key === 'ai')
    const item = aiGroup?.items.find((i) => i.id === 'vacancy_generation')
    expect(item?.requiresPermission).toBe('vacancy_generation.manage')
  })
})
