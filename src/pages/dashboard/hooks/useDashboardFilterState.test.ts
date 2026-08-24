/**
 * useDashboardFilterState — K-173 fase 3: the branch filter sends `branch_id[]`
 * (multi-value, the VESTIGING-2 convention), never the legacy single-value
 * `location_id`. Pinned per §13 — the request shape, not just that a callback
 * fired.
 */
import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDashboardFilterState } from './useDashboardFilterState'

describe('useDashboardFilterState · K-173 fase 3 branch_id[]', () => {
  it('sends branch_id as an array of the selected branches, never location_id', () => {
    const { result } = renderHook(() => useDashboardFilterState())
    act(() => result.current.setSelVestiging(['1', 'none']))
    expect(result.current.dashFilterParams).toEqual({ branch_id: ['1', 'none'] })
    expect(result.current.dashFilterParams).not.toHaveProperty('location_id')
  })

  it('omits branch_id entirely when nothing is selected', () => {
    const { result } = renderHook(() => useDashboardFilterState())
    expect(result.current.dashFilterParams).toEqual({})
  })

  it('combines branch_id with period/status when all three are set', () => {
    const { result } = renderHook(() => useDashboardFilterState())
    act(() => {
      result.current.setSelPeriode(['week'])
      result.current.setSelStatus(['available'])
      result.current.setSelVestiging(['2'])
    })
    expect(result.current.dashFilterParams).toEqual({ period: 'week', status: 'available', branch_id: ['2'] })
  })
})
