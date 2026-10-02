import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGuardedSubmit } from './useGuardedSubmit'

// ONIX N-007: two clicks in the same tick must run the submit ONCE.
describe('useGuardedSubmit', () => {
  it('runs once for a double call and reports saving while in flight', async () => {
    let resolve!: () => void
    const run = vi.fn(() => new Promise<void>(r => { resolve = r }))
    const { result } = renderHook(() => useGuardedSubmit(run))
    expect(result.current.saving).toBe(false)
    let first: Promise<void> | undefined
    await act(async () => { first = result.current.submit(); void result.current.submit() })
    expect(run).toHaveBeenCalledTimes(1)
    expect(result.current.saving).toBe(true)
    await act(async () => { resolve(); await first })
    expect(result.current.saving).toBe(false)
  })

  it('accepts a new submit after the previous one settled', async () => {
    const run = vi.fn(async () => {})
    const { result } = renderHook(() => useGuardedSubmit(run))
    await act(async () => { await result.current.submit() })
    await act(async () => { await result.current.submit() })
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('resets saving and the latch when the run rejects, and propagates the error', async () => {
    const run = vi.fn(async () => { throw new Error('nope') })
    const { result } = renderHook(() => useGuardedSubmit(run))
    await act(async () => { await expect(result.current.submit()).rejects.toThrow('nope') })
    expect(result.current.saving).toBe(false)
    await act(async () => { await result.current.submit().catch(() => undefined) })
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('always calls the LATEST run function (no stale closure after a re-render)', async () => {
    const first = vi.fn(async () => {}); const second = vi.fn(async () => {})
    const { result, rerender } = renderHook(({ run }) => useGuardedSubmit(run), { initialProps: { run: first } })
    rerender({ run: second })
    await act(async () => { await result.current.submit() })
    expect(first).not.toHaveBeenCalled(); expect(second).toHaveBeenCalledTimes(1)
  })
})
