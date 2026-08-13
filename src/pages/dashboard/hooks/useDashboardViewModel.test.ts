/**
 * useDashboardViewModel — D6/D1(a) tile visibility (no zero-tile invention, §3):
 * the recruitment KPI row includes tooLongInStage/missingApptApps/closingSoon/
 * staleStatusVac only when the backend actually returned that attention key.
 */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDashboardViewModel } from './useDashboardViewModel'

// Minimal args — only the fields the recruitment KPI row + attention merge read.
const baseArgs = (overrides: Record<string, unknown> = {}) => ({
  t: (k: string) => k,
  formatNumber: (v: number) => String(v),
  stats: null,
  opp: null,
  dash: null,
  dashCharts: null,
  statusMeta: () => ({ value: '', label: '', color: '' }),
  funnelMeta: () => ({ value: '', label: '', color: '' }),
  funnelTypes: [],
  activeType: 'recruitment' as const,
  hiddenBlocks: [],
  hiddenKpis: [],
  hasPlanning: false,
  valueInHours: false,
  candidateTotalLabel: '0',
  matchesTotal: null,
  vacanciesTotal: null,
  ...overrides,
})

describe('useDashboardViewModel · D6/D1(a) tile visibility', () => {
  it('omits the four new tiles when appStats/vacStats are absent', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs()))
    const ids = result.current.kpis.map(k => k.id)
    expect(ids).not.toContain('tooLongInStage')
    expect(ids).not.toContain('missingApptApps')
    expect(ids).not.toContain('closingSoon')
    expect(ids).not.toContain('staleStatusVac')
  })

  it('renders each tile once its backend key is present', () => {
    const { result } = renderHook(() => useDashboardViewModel(baseArgs({
      appStats: { attention: { too_long_in_stage: 3, missing_appointment: 2 } },
      vacStats: { attention: { closing_soon: 5, stale_status: 1 } },
    })))
    const ids = result.current.kpis.map(k => k.id)
    expect(ids).toEqual(expect.arrayContaining(['tooLongInStage', 'missingApptApps', 'closingSoon', 'staleStatusVac']))
  })
})
