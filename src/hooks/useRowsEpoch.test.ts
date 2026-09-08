import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useRowsEpoch } from './useRowsEpoch'

describe('useRowsEpoch', () => {
  it('first settled render seeds without bumping (epoch 0)', () => {
    const rows = [{ id: '1' }, { id: '2' }]
    const { result } = renderHook(() => useRowsEpoch(false, rows))
    expect(result.current).toBe(0)
  })

  it('same ids again → still 0', () => {
    const rows = [{ id: '1' }, { id: '2' }]
    const { result, rerender: hook_rerender } = renderHook(() => useRowsEpoch(false, rows))
    expect(result.current).toBe(0)

    // Rerender with the exact same rows — epoch should stay 0
    hook_rerender()
    expect(result.current).toBe(0)
  })

  it('a changed id set → 1', () => {
    const rows1 = [{ id: '1' }, { id: '2' }]
    const { result, rerender: hook_rerender } = renderHook(({ isFetching, rows }) => useRowsEpoch(isFetching, rows), {
      initialProps: { isFetching: false, rows: rows1 },
    })
    expect(result.current).toBe(0)

    // Change the row set
    const rows2 = [{ id: '1' }, { id: '3' }]
    hook_rerender({ isFetching: false, rows: rows2 })
    expect(result.current).toBe(1)
  })

  it('while `isFetching` nothing happens even if rows differ', () => {
    const rows1 = [{ id: '1' }, { id: '2' }]
    const { result, rerender: hook_rerender } = renderHook(({ isFetching, rows }) => useRowsEpoch(isFetching, rows), {
      initialProps: { isFetching: false, rows: rows1 },
    })
    expect(result.current).toBe(0)

    // Start fetching, change rows — epoch should NOT bump
    const rows2 = [{ id: '1' }, { id: '3' }]
    hook_rerender({ isFetching: true, rows: rows2 })
    expect(result.current).toBe(0)

    // Stop fetching — now it should detect the change
    hook_rerender({ isFetching: false, rows: rows2 })
    expect(result.current).toBe(1)
  })

  it('rows undefined treated as empty', () => {
    type Props = { isFetching: boolean; rows?: ReadonlyArray<{ id: string }> }
    const { result, rerender: hook_rerender } = renderHook(({ isFetching, rows }: Props) => useRowsEpoch(isFetching, rows), {
      initialProps: { isFetching: false } as Props,
    })
    expect(result.current).toBe(0)

    // Add rows
    const rows2 = [{ id: '1' }]
    hook_rerender({ isFetching: false, rows: rows2 } as Props)
    expect(result.current).toBe(1)

    // Go back to undefined — should bump again
    hook_rerender({ isFetching: false } as Props)
    expect(result.current).toBe(2)
  })
})
