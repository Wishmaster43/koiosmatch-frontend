// Selection state shared by search tabs: parentId change resets selection, selectedRow derives from rows.
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSearchSelection } from './useSearchSelection'

describe('useSearchSelection — shared selection state for search tabs', () => {
  it('selects a row by id and derives the selected row object', () => {
    const rows = [
      { id: 'r1', title: 'Row 1' },
      { id: 'r2', title: 'Row 2' },
    ]
    const { result } = renderHook(() => useSearchSelection('parent1', rows))

    expect(result.current.selectedId).toBeNull()
    expect(result.current.selectedRow).toBeNull()

    act(() => result.current.selectId('r1'))
    expect(result.current.selectedId).toBe('r1')
    expect(result.current.selectedRow).toEqual(rows[0])
  })

  it('resets selection when the parent entity changes', () => {
    const rows = [{ id: 'r1', title: 'Row 1' }]
    const { result, rerender } = renderHook(
      ({ parentId }) => useSearchSelection(parentId, rows),
      { initialProps: { parentId: 'parent1' } },
    )

    act(() => result.current.selectId('r1'))
    expect(result.current.selectedId).toBe('r1')

    // Parent changes → selection resets.
    act(() => rerender({ parentId: 'parent2' }))
    expect(result.current.selectedId).toBeNull()
    expect(result.current.selectedRow).toBeNull()
  })

  it('returns null selectedRow when the selected id is not in the current rows', () => {
    const rows = [{ id: 'r1', title: 'Row 1' }]
    const { result, rerender } = renderHook(
      ({ rows: r }) => useSearchSelection('parent1', r),
      { initialProps: { rows } },
    )

    act(() => result.current.selectId('r1'))
    expect(result.current.selectedRow).toEqual(rows[0])

    // Rows change and the selected row is no longer present.
    act(() => rerender({ rows: [{ id: 'r2', title: 'Row 2' }] }))
    expect(result.current.selectedId).toBe('r1')
    expect(result.current.selectedRow).toBeNull()
  })
})
