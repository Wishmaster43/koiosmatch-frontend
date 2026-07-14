import { describe, it, expect, vi } from 'vitest'
import { isCategoryVisible } from './koiosMentionAccess'
import type { MentionCategoryConfig } from './koiosMentionCategories'
import type { AuthContextValue } from '@/context/AuthContext'

vi.mock('@/lib/access', () => ({ canAccessPage: vi.fn((pageId: string) => pageId === 'aiagents') }))

const authWith = (perm: string | null) => ({
  hasPermission: (p: string) => p === perm,
}) as unknown as AuthContextValue

const permCategory: MentionCategoryConfig = {
  id: 'vacancies', labelKey: 'nav.vacancies',
  search: { endpoint: '/vacancies', param: 'search', permission: 'vacancies.view', refType: 'vacancy', present: () => ({ id: '1', name: 'x' }) },
}
const pageGateCategory: MentionCategoryConfig = {
  id: 'aiagents', labelKey: 'nav.aiagents',
  search: { endpoint: '/workflows', param: 'search', pageGate: 'aiagents', refType: 'workflow', present: () => ({ id: '1', name: 'x' }) },
}
const noSearchCategory: MentionCategoryConfig = { id: 'locations', labelKey: 'koios.mention.locations' }

describe('isCategoryVisible', () => {
  it('shows a permission-gated category when the user holds the permission', () => {
    expect(isCategoryVisible(permCategory, authWith('vacancies.view'))).toBe(true)
  })

  it('hides a permission-gated category without the permission', () => {
    expect(isCategoryVisible(permCategory, authWith('candidates.view'))).toBe(false)
  })

  it('hides a permission-gated category with no auth at all', () => {
    expect(isCategoryVisible(permCategory, null)).toBe(false)
  })

  it('defers to canAccessPage for a pageGate category', () => {
    expect(isCategoryVisible(pageGateCategory, authWith(null))).toBe(true) // mocked: true for 'aiagents'
  })

  it('always shows a category with no search wiring (e.g. locations)', () => {
    expect(isCategoryVisible(noSearchCategory, null)).toBe(true)
  })
})
