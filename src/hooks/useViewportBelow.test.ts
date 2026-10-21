import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useViewportBelow } from './useViewportBelow'

// Installs a controllable matchMedia mock and returns a trigger for `change` events.
function mockMatchMedia(initial: boolean) {
  let listener: (() => void) | null = null
  const mq = {
    matches: initial,
    addEventListener: vi.fn((_: string, cb: () => void) => { listener = cb }),
    removeEventListener: vi.fn(),
  }
  const mm = vi.fn(() => mq)
  window.matchMedia = mm as unknown as typeof window.matchMedia
  return { mq, mm, fire: (m: boolean) => { mq.matches = m; listener?.() } }
}

describe('useViewportBelow', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('queries max-width px-1 and reports the initial match', () => {
    const { mm } = mockMatchMedia(true)
    const { result } = renderHook(() => useViewportBelow(1024))
    expect(mm).toHaveBeenCalledWith('(max-width: 1023px)')
    expect(result.current).toBe(true)
  })

  it('reports false when the viewport is wide enough', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useViewportBelow(1024))
    expect(result.current).toBe(false)
  })

  it('follows live change events', () => {
    const m = mockMatchMedia(false)
    const { result } = renderHook(() => useViewportBelow(1024))
    act(() => m.fire(true))
    expect(result.current).toBe(true)
  })
})
