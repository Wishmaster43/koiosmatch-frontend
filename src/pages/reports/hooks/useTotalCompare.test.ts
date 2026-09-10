/**
 * useTotalCompare — thin wrapper test: proves it forwards its args to
 * useReportCompare verbatim and extracts+gates totalCompare on compare.kind,
 * mirroring useReportCompareData.test.tsx's wrapper-test shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTotalCompare } from './useTotalCompare'

const mockUseReportCompare = vi.fn()
vi.mock('../useReportCompare', () => ({ useReportCompare: (...args: unknown[]) => mockUseReportCompare(...args) }))

describe('useTotalCompare', () => {
  beforeEach(() => mockUseReportCompare.mockReset())

  it('forwards slug/from/to/compare/extraParams to useReportCompare untouched', () => {
    mockUseReportCompare.mockReturnValue({ data: null })
    renderHook(() => useTotalCompare('outreach', '2026-08-01', '2026-08-31', { kind: 'previous_period' }, { period: 'month' }))
    expect(mockUseReportCompare).toHaveBeenCalledWith('outreach', '2026-08-01', '2026-08-31', { kind: 'previous_period' }, { period: 'month' })
  })

  it('extracts the total metric when compare is active', () => {
    const total = { current: 10, previous: 8, delta: 2, delta_pct: 25 }
    mockUseReportCompare.mockReturnValue({ data: { total } })
    const { result } = renderHook(() => useTotalCompare('outreach', '2026-08-01', '2026-08-31', { kind: 'previous_year' }))
    expect(result.current).toEqual(total)
  })

  it('returns undefined when compare is off, even with data present', () => {
    mockUseReportCompare.mockReturnValue({ data: { total: { current: 1, previous: 1, delta: 0, delta_pct: 0 } } })
    const { result } = renderHook(() => useTotalCompare('outreach', '2026-08-01', '2026-08-31', { kind: 'off' }))
    expect(result.current).toBeUndefined()
  })

  it('defaults extraParams to an empty object', () => {
    mockUseReportCompare.mockReturnValue({ data: null })
    renderHook(() => useTotalCompare('opportunities', undefined, undefined, { kind: 'off' }))
    expect(mockUseReportCompare).toHaveBeenCalledWith('opportunities', undefined, undefined, { kind: 'off' }, {})
  })
})
