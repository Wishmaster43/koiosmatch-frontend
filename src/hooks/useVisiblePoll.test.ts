import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVisiblePoll } from './useVisiblePoll'

describe('useVisiblePoll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('calls load after the interval when visible', () => {
    const load = vi.fn()
    renderHook(() => useVisiblePoll(load, 5000))

    expect(load).not.toHaveBeenCalled()
    vi.advanceTimersByTime(5000)
    expect(load).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('does NOT call load while document.visibilityState is hidden', () => {
    const load = vi.fn()
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    renderHook(() => useVisiblePoll(load, 5000))

    vi.advanceTimersByTime(5000)
    expect(load).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    vi.advanceTimersByTime(5000)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('clears the timer on unmount', () => {
    const load = vi.fn()
    const { unmount } = renderHook(() => useVisiblePoll(load, 5000))

    vi.advanceTimersByTime(5000)
    expect(load).toHaveBeenCalledTimes(1)

    unmount()
    vi.advanceTimersByTime(5000)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('never schedules when enabled=false', () => {
    const load = vi.fn()
    renderHook(() => useVisiblePoll(load, 5000, false))

    vi.advanceTimersByTime(5000)
    expect(load).not.toHaveBeenCalled()
  })
})
