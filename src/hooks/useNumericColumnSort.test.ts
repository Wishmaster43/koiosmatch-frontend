import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import useNumericColumnSort from './useNumericColumnSort'
import type { SortState } from '@/types/reports'

describe('useNumericColumnSort', () => {
  const rows = [
    { id: 1, count: 5 },
    { id: 2, count: 2 },
    { id: 3, count: 10 },
    { id: 4, count: 3 },
  ]

  it('returns rows unsorted when sort key does not match', () => {
    const { result } = renderHook(() =>
      useNumericColumnSort<typeof rows[0]>(rows, { key: 'name', dir: 'asc' }, 'count', (r) => r.count)
    )
    expect(result.current).toEqual(rows)
  })

  it('sorts ascending by numeric value', () => {
    const sort: SortState = { key: 'count', dir: 'asc' }
    const { result } = renderHook(() =>
      useNumericColumnSort<typeof rows[0]>(rows, sort, 'count', (r) => r.count)
    )
    expect(result.current.map((r) => r.count)).toEqual([2, 3, 5, 10])
  })

  it('sorts descending by numeric value', () => {
    const sort: SortState = { key: 'count', dir: 'desc' }
    const { result } = renderHook(() =>
      useNumericColumnSort<typeof rows[0]>(rows, sort, 'count', (r) => r.count)
    )
    expect(result.current.map((r) => r.count)).toEqual([10, 5, 3, 2])
  })

  it('treats undefined values as 0', () => {
    const rowsWithUndefined = [
      { id: 1, count: 5 },
      { id: 2, count: undefined },
      { id: 3, count: 2 },
    ]
    const sort: SortState = { key: 'count', dir: 'asc' }
    const { result } = renderHook(() =>
      useNumericColumnSort<typeof rowsWithUndefined[0]>(
        rowsWithUndefined,
        sort,
        'count',
        (r) => r.count
      )
    )
    expect(result.current.map((r) => r.count)).toEqual([undefined, 2, 5])
  })
})
