import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useToggleSelected } from './useToggleSelected'

interface Row { id: string; name: string }

describe('useToggleSelected', () => {
  it('selects a row on first click', () => {
    const { result } = renderHook(() => useToggleSelected<Row>())
    act(() => result.current.toggleSelected({ id: '1', name: 'A' }))
    expect(result.current.selected?.id).toBe('1')
  })

  it('clicking the already-selected row closes it (toggles to null)', () => {
    const { result } = renderHook(() => useToggleSelected<Row>())
    const row = { id: '1', name: 'A' }
    act(() => result.current.toggleSelected(row))
    act(() => result.current.toggleSelected(row))
    expect(result.current.selected).toBeNull()
  })

  it('clicking a different row replaces the selection', () => {
    const { result } = renderHook(() => useToggleSelected<Row>())
    act(() => result.current.toggleSelected({ id: '1', name: 'A' }))
    act(() => result.current.toggleSelected({ id: '2', name: 'B' }))
    expect(result.current.selected?.id).toBe('2')
  })
})
