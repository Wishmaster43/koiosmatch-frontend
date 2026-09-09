/**
 * useEntityChangeListener — asserts the listener fires `load` with an AbortSignal on the
 * named event, and that unmounting removes the listener (no further calls after teardown).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEntityChangeListener } from './useEntityChangeListener'

describe('useEntityChangeListener', () => {
  it('calls load with an AbortSignal when the named event fires', () => {
    const load = vi.fn()
    renderHook(() => useEntityChangeListener('km:test-changed', load))

    window.dispatchEvent(new CustomEvent('km:test-changed'))

    expect(load).toHaveBeenCalledTimes(1)
    expect(load.mock.calls[0][0]).toBeInstanceOf(AbortSignal)
  })

  it('stops listening after unmount', () => {
    const load = vi.fn()
    const { unmount } = renderHook(() => useEntityChangeListener('km:test-changed', load))
    unmount()

    window.dispatchEvent(new CustomEvent('km:test-changed'))

    expect(load).not.toHaveBeenCalled()
  })
})
