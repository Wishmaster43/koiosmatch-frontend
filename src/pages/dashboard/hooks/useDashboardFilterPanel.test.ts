/**
 * useDashboardFilterPanel — registers the three filter groups under English keys.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDashboardFilterPanel } from './useDashboardFilterPanel'

const registerFilters = vi.fn()
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters, unregisterFilters: vi.fn() }),
}))
vi.mock('@/lib/useBranchOptions', () => ({ useBranchOptions: () => [] }))

describe('useDashboardFilterPanel', () => {
  // The group keys are identifiers: English only (FILES-EN-1).
  it('registers the groups period, branch and status for the dashboard', () => {
    renderHook(() => useDashboardFilterPanel({
      dash: null, t: (k: string) => k,
      selPeriod: [], setSelPeriod: vi.fn(), selBranch: [], setSelBranch: vi.fn(), selStatus: [], setSelStatus: vi.fn(),
    }))
    const [page, groups] = registerFilters.mock.calls[0]
    expect(page).toBe('dashboard')
    expect(groups.map((g: { key: string }) => g.key)).toEqual(['period', 'branch', 'status'])
  })
})
