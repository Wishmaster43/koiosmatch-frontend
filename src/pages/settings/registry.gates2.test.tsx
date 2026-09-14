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

describe('registry — vacancy_generation permission gate', () => {
  it('vacancy_generation declares requiresPermission: vacancy_generation.manage', () => {
    const aiGroup = NAV_GROUPS.find((g) => g.key === 'ai')
    const item = aiGroup?.items.find((i) => i.id === 'vacancy_generation')
    expect(item?.requiresPermission).toBe('vacancy_generation.manage')
  })
})
