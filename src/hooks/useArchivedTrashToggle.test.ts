import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { useArchivedTrashToggle } from './useArchivedTrashToggle'

// TRASH-OVERAL-2: the archived/trash quick views are mutually exclusive — turning one
// on must turn the other off, on both list pages that share this hook.
function useHarness() {
  const [showArchived, setShowArchived] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const { onToggleArchived, onToggleTrash } = useArchivedTrashToggle(setShowArchived, setShowTrash)
  return { showArchived, showTrash, onToggleArchived, onToggleTrash }
}

describe('useArchivedTrashToggle', () => {
  it('turning archived on turns trash off', () => {
    const { result } = renderHook(() => useHarness())
    act(() => result.current.onToggleTrash())
    expect(result.current.showTrash).toBe(true)
    act(() => result.current.onToggleArchived())
    expect(result.current.showArchived).toBe(true)
    expect(result.current.showTrash).toBe(false)
  })

  it('turning trash on turns archived off', () => {
    const { result } = renderHook(() => useHarness())
    act(() => result.current.onToggleArchived())
    expect(result.current.showArchived).toBe(true)
    act(() => result.current.onToggleTrash())
    expect(result.current.showTrash).toBe(true)
    expect(result.current.showArchived).toBe(false)
  })

  it('toggling the same view again switches it back off', () => {
    const { result } = renderHook(() => useHarness())
    act(() => result.current.onToggleArchived())
    act(() => result.current.onToggleArchived())
    expect(result.current.showArchived).toBe(false)
  })
})
