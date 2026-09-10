/**
 * useDrillPager — verifies the pager position/prev/next math against the filtered
 * `visible` list, and that it is undefined when the open record fell out of it.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDrillPager } from './useDrillPager'

const rows = [{ id: '1' }, { id: '2' }, { id: '3' }]

describe('useDrillPager', () => {
  it('returns undefined when there is no open record', () => {
    const onOpenChange = vi.fn()
    const { result } = renderHook(() => useDrillPager(rows, null, onOpenChange))
    expect(result.current).toBeUndefined()
  })

  it('returns undefined when the open record is not in the visible rows', () => {
    const onOpenChange = vi.fn()
    const { result } = renderHook(() => useDrillPager(rows, { id: '9' }, onOpenChange))
    expect(result.current).toBeUndefined()
  })

  it('computes a 1-based position and wires prev/next to the neighbouring rows', () => {
    const onOpenChange = vi.fn()
    const { result } = renderHook(() => useDrillPager(rows, rows[1], onOpenChange))
    expect(result.current?.index).toBe(2)
    expect(result.current?.total).toBe(3)
    result.current?.onPrev?.()
    expect(onOpenChange).toHaveBeenCalledWith('1')
    result.current?.onNext?.()
    expect(onOpenChange).toHaveBeenCalledWith('3')
  })

  it('disables onPrev at the first row and onNext at the last row', () => {
    const onOpenChange = vi.fn()
    const first = renderHook(() => useDrillPager(rows, rows[0], onOpenChange))
    // A regressed hook returning undefined for a valid open row would make the
    // optional-chained onPrev check pass vacuously — assert the pager itself exists first.
    expect(first.result.current).toBeDefined()
    expect(first.result.current?.onPrev).toBeUndefined()
    const last = renderHook(() => useDrillPager(rows, rows[2], onOpenChange))
    expect(last.result.current).toBeDefined()
    expect(last.result.current?.onNext).toBeUndefined()
  })
})
