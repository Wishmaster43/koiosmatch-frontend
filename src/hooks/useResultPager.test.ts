/**
 * useResultPager — behaviour: selectedIndex tracks the current row, goPrev/
 * goNext are undefined at the list ends (no cycling), and each calls selectId
 * with the neighbouring row's id.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultPager } from './useResultPager'

const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('useResultPager', () => {
  it('reports -1 and undefined prev/next when nothing is selected', () => {
    const { result } = renderHook(() => useResultPager(rows, null, vi.fn()))
    expect(result.current.selectedIndex).toBe(-1)
    expect(result.current.goPrev).toBeUndefined()
    expect(result.current.goNext).toBeUndefined()
  })

  it('disables goPrev on the first row and goNext calls selectId with the next id', () => {
    const selectId = vi.fn()
    const { result } = renderHook(() => useResultPager(rows, 'a', selectId))
    expect(result.current.selectedIndex).toBe(0)
    expect(result.current.goPrev).toBeUndefined()
    result.current.goNext?.()
    expect(selectId).toHaveBeenCalledWith('b')
  })

  it('disables goNext on the last row and goPrev calls selectId with the previous id', () => {
    const selectId = vi.fn()
    const { result } = renderHook(() => useResultPager(rows, 'c', selectId))
    expect(result.current.selectedIndex).toBe(2)
    expect(result.current.goNext).toBeUndefined()
    result.current.goPrev?.()
    expect(selectId).toHaveBeenCalledWith('b')
  })
})
