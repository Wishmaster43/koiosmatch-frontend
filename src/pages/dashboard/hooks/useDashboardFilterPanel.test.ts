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

  // Period option values are English ids; labels echo the filters.period.<id> key.
  it('offers the English period ids with key-echoed labels', () => {
    registerFilters.mockClear()
    renderHook(() => useDashboardFilterPanel({
      dash: null, t: (k: string) => k,
      selPeriod: [], setSelPeriod: vi.fn(), selBranch: [], setSelBranch: vi.fn(), selStatus: [], setSelStatus: vi.fn(),
    }))
    const period = registerFilters.mock.calls[0][1].find((g: { key: string }) => g.key === 'period')
    expect(period.options.map((o: { value: string }) => o.value)).toEqual(['today', 'week', 'month', 'quarter', 'year'])
    expect(period.options.map((o: { label: string }) => o.label)).toEqual(
      ['today', 'week', 'month', 'quarter', 'year'].map(v => `filters.period.${v}`))
  })
})
