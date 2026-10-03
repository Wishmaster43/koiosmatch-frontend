/**
 * useWorkflowRowState — the running/restoring/hover trio shared by WorkflowCard
 * and WorkflowListRow: each setter flips only its own flag, independent of the
 * other two.
 */
import { describe, it, expect, vi } from 'vitest'
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

// N007-POINT3-FIX-1: the shared "run once, flash done" wrapper (SHARED-UNIT-TEST-1
// — this is its own unit test, not only coverage via the two adopter components).
describe('useWorkflowRowState · runWithDoneFlash', () => {
  it('sets running during the call, then justRan after success, and clears justRan after the flash', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useWorkflowRowState())
    let resolveOnRun!: () => void
    const onRun = vi.fn(() => new Promise<void>(res => { resolveOnRun = res }))

    let pending!: Promise<void>
    act(() => { pending = result.current.runWithDoneFlash(onRun, 'wf-1') })
    expect(result.current.running).toBe(true)
    expect(onRun).toHaveBeenCalledWith('wf-1')

    await act(async () => { resolveOnRun(); await pending })
    expect(result.current.running).toBe(false)
    expect(result.current.justRan).toBe(true)

    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(result.current.justRan).toBe(false)
    vi.useRealTimers()
  })

  it('a call while running or still flashing justRan never calls onRun again', async () => {
    const { result } = renderHook(() => useWorkflowRowState())
    const onRun = vi.fn().mockResolvedValue(undefined)

    let first!: Promise<void>
    act(() => { first = result.current.runWithDoneFlash(onRun, 'wf-1') })
    // A repeat call while the first is still running must be a no-op.
    await act(async () => { await result.current.runWithDoneFlash(onRun, 'wf-1') })
    await act(async () => { await first })
    expect(onRun).toHaveBeenCalledTimes(1)

    // And a repeat call during the "just ran" flash is also a no-op.
    await act(async () => { await result.current.runWithDoneFlash(onRun, 'wf-1') })
    expect(onRun).toHaveBeenCalledTimes(1)
  })

  it('clears running even when onRun rejects, so a failed run can be retried', async () => {
    const { result } = renderHook(() => useWorkflowRowState())
    const onRun = vi.fn().mockRejectedValue(new Error('boom'))

    await act(async () => { await expect(result.current.runWithDoneFlash(onRun, 'wf-1')).rejects.toThrow('boom') })
    expect(result.current.running).toBe(false)
    expect(result.current.justRan).toBe(false)
  })

  // N007-POINT3-FIX-1 verifier fix: onRun resolving `false` means the run was
  // REFUSED/FAILED (e.g. a 409 or 422 — see useWorkflowsData.handleRun) — never
  // flash "just started" over something that did not actually start.
  it('onRun resolving false never sets justRan, and running clears', async () => {
    const { result } = renderHook(() => useWorkflowRowState())
    const onRun = vi.fn().mockResolvedValue(false)

    await act(async () => { await result.current.runWithDoneFlash(onRun, 'wf-1') })
    expect(result.current.running).toBe(false)
    expect(result.current.justRan).toBe(false)
  })
})
