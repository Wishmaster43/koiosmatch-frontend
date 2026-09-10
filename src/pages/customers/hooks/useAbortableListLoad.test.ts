import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAbortableListLoad } from './useAbortableListLoad'

describe('useAbortableListLoad', () => {
  it('calls load once on mount with an AbortSignal', () => {
    const load = vi.fn()
    renderHook(() => useAbortableListLoad(load, 'km:test-changed'))

    expect(load).toHaveBeenCalledTimes(1)
    expect(load.mock.calls[0][0]).toBeInstanceOf(AbortSignal)
  })

  it('aborts the in-flight request on unmount', () => {
    const load = vi.fn()
    const { unmount } = renderHook(() => useAbortableListLoad(load, 'km:test-changed'))
    const signal = load.mock.calls[0][0] as AbortSignal
    expect(signal.aborted).toBe(false)

    unmount()
    expect(signal.aborted).toBe(true)
  })

  it('reloads when the named change event fires on window', () => {
    const load = vi.fn()
    renderHook(() => useAbortableListLoad(load, 'km:test-changed'))
    expect(load).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new CustomEvent('km:test-changed'))
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('does not react to a differently-named event', () => {
    const load = vi.fn()
    renderHook(() => useAbortableListLoad(load, 'km:test-changed'))
    window.dispatchEvent(new CustomEvent('km:other-changed'))
    expect(load).toHaveBeenCalledTimes(1)
  })
})
