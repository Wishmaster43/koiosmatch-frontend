import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRetryCountdown } from './useRetryCountdown'

describe('useRetryCountdown', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('is inactive until started, counts down per second and clears at zero', () => {
    const { result } = renderHook(() => useRetryCountdown())
    expect(result.current.seconds).toBeNull()
    expect(result.current.active).toBe(false)
    act(() => result.current.start(2))
    expect(result.current.active).toBe(true)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.seconds).toBe(1)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(result.current.seconds).toBeNull()
    expect(result.current.active).toBe(false)
  })

  it('clear() disarms a running countdown', () => {
    const { result } = renderHook(() => useRetryCountdown())
    act(() => result.current.start(5))
    act(() => result.current.clear())
    expect(result.current.seconds).toBeNull()
  })
})
