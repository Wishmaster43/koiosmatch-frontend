import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePageSlice } from './usePageSlice'

// usePageSlice — the totalRows/lastPage/filtered arithmetic shared by
// opportunities/tasks/matches (DRY round 11, BULKBARS).
describe('usePageSlice', () => {
  it('slices the array to the current page', () => {
    const rows = Array.from({ length: 25 }, (_, i) => i)
    const { result } = renderHook(() => usePageSlice(rows, 2, 10))
    expect(result.current.totalRows).toBe(25)
    expect(result.current.lastPage).toBe(3)
    expect(result.current.filtered).toEqual(rows.slice(10, 20))
  })

  it('reports a last page of 1 for an empty array (never 0)', () => {
    const { result } = renderHook(() => usePageSlice([] as number[], 1, 10))
    expect(result.current.totalRows).toBe(0)
    expect(result.current.lastPage).toBe(1)
    expect(result.current.filtered).toEqual([])
  })

  it('returns the tail slice on the last page', () => {
    const rows = Array.from({ length: 25 }, (_, i) => i)
    const { result } = renderHook(() => usePageSlice(rows, 3, 10))
    expect(result.current.filtered).toEqual(rows.slice(20, 30))
  })
})
