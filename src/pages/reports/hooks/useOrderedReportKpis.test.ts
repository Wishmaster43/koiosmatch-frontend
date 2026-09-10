/**
 * useOrderedReportKpis — thin combinator test: proves the hook calls
 * useReportKpiOrdering with the given scope and orders the caller's kpiByKey
 * record by the resolved kpiOrder (dropping keys without a spec), mirroring
 * useReportCompareData.test.tsx's wrapper-test shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import { useOrderedReportKpis } from './useOrderedReportKpis'

const mockUseReportKpiOrdering = vi.fn()
vi.mock('./useReportKpiOrdering', () => ({ useReportKpiOrdering: (...args: unknown[]) => mockUseReportKpiOrdering(...args) }))

const spec = (key: string) => ({ key, label: key, value: 1 }) as unknown as KpiSpec

describe('useOrderedReportKpis', () => {
  beforeEach(() => mockUseReportKpiOrdering.mockReset())

  it('calls useReportKpiOrdering with the scope and orders kpiByKey by the resolved order', () => {
    mockUseReportKpiOrdering.mockReturnValue({ kpiOrder: ['c', 'x', 'a'], fellBack: false, isLoading: false })
    const kpiByKey = { a: spec('a'), b: spec('b'), c: spec('c') }

    const { result } = renderHook(() => useOrderedReportKpis('matches', kpiByKey))

    expect(mockUseReportKpiOrdering).toHaveBeenCalledWith('matches')
    // 'x' has no spec and drops out; 'b' is never listed in the order and never renders.
    expect(result.current.kpis.map(k => k.key)).toEqual(['c', 'a'])
  })

  it('passes fellBack through untouched', () => {
    mockUseReportKpiOrdering.mockReturnValue({ kpiOrder: ['a'], fellBack: true, isLoading: false })
    const { result } = renderHook(() => useOrderedReportKpis('tasks', { a: spec('a') }))
    expect(result.current.fellBack).toBe(true)
  })
})
