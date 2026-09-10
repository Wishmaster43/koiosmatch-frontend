/**
 * useWorkflowRowState — the running/restoring/hover trio shared by WorkflowCard
 * and WorkflowListRow: each setter flips only its own flag, independent of the
 * other two.
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWorkflowRowState } from './useWorkflowRowState'

describe('useWorkflowRowState', () => {
  it('starts with running/restoring/hover all false', () => {
    const { result } = renderHook(() => useWorkflowRowState())
    expect(result.current.running).toBe(false)
    expect(result.current.restoring).toBe(false)
    expect(result.current.hover).toBe(false)
  })

  it('each setter flips only its own flag', () => {
    const { result } = renderHook(() => useWorkflowRowState())
    act(() => result.current.setRunning(true))
    expect(result.current.running).toBe(true)
    expect(result.current.restoring).toBe(false)
    expect(result.current.hover).toBe(false)

    act(() => result.current.setHover(true))
    expect(result.current.hover).toBe(true)
    expect(result.current.running).toBe(true)
    expect(result.current.restoring).toBe(false)
  })
})
