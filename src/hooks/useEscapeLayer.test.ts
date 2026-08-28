/**
 * useEscapeLayer — regression pins for the layered-Escape architecture
 * (TRIAGE-3.3): top-first closing, one press per layer, stack hygiene when an
 * outer layer unmounts under an inner one.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEscapeLayer, __escapeLayerCount } from './useEscapeLayer'

const pressEscape = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

describe('useEscapeLayer', () => {
  it('closes ONLY the top layer per press, then the next', () => {
    const outer = vi.fn(); const inner = vi.fn()
    const a = renderHook(() => useEscapeLayer(true, outer))
    const b = renderHook(() => useEscapeLayer(true, inner))
    pressEscape()
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
    b.unmount()
    pressEscape()
    expect(outer).toHaveBeenCalledTimes(1)
    a.unmount()
    expect(__escapeLayerCount()).toBe(0)
  })

  it('ignores inactive layers and does not leak them onto the stack', () => {
    const closed = vi.fn()
    const h = renderHook(({ active }) => useEscapeLayer(active, closed), { initialProps: { active: false } })
    expect(__escapeLayerCount()).toBe(0)
    pressEscape()
    expect(closed).not.toHaveBeenCalled()
    h.rerender({ active: true })
    pressEscape()
    expect(closed).toHaveBeenCalledTimes(1)
    h.unmount()
    expect(__escapeLayerCount()).toBe(0)
  })

  it('survives an outer layer unmounting while an inner one is open', () => {
    const outer = vi.fn(); const inner = vi.fn()
    const a = renderHook(() => useEscapeLayer(true, outer))
    renderHook(() => useEscapeLayer(true, inner))
    a.unmount() // outer drawer closes by click while its inner menu is open
    pressEscape()
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
  })

  it('always uses the LATEST onClose callback (no stale closure)', () => {
    const first = vi.fn(); const second = vi.fn()
    const h = renderHook(({ cb }) => useEscapeLayer(true, cb), { initialProps: { cb: first } })
    h.rerender({ cb: second })
    pressEscape()
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })
})
