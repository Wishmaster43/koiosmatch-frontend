import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useActionMessage } from './useActionMessage'

// The one list-page notify mechanism (§3): shows a message, auto-dismisses after 4s,
// and a later notify cancels the previous timer instead of the two racing.
describe('useActionMessage', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('sets the message and auto-dismisses after 4s', () => {
    const { result } = renderHook(() => useActionMessage())
    act(() => result.current.notify('success', 'Saved'))
    expect(result.current.actionMsg).toEqual({ type: 'success', text: 'Saved', action: undefined })
    act(() => vi.advanceTimersByTime(4000))
    expect(result.current.actionMsg).toBeNull()
  })

  it('a second notify before the timer fires replaces the message and resets the clock', () => {
    const { result } = renderHook(() => useActionMessage())
    act(() => result.current.notify('success', 'First'))
    act(() => vi.advanceTimersByTime(3000))
    act(() => result.current.notify('error', 'Second'))
    // The first timer must not fire and clear the second message early.
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.actionMsg?.text).toBe('Second')
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.actionMsg).toBeNull()
  })

  it('carries an optional inline follow-up action', () => {
    const onClick = vi.fn()
    const { result } = renderHook(() => useActionMessage())
    act(() => result.current.notify('success', 'Restored', { label: 'Open', onClick }))
    expect(result.current.actionMsg?.action?.label).toBe('Open')
  })
})
