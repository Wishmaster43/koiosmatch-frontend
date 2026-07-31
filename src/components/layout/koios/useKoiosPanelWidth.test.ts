import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useKoiosPanelWidth, WIDTH_COLLAPSED, WIDTH_EXPANDED } from './useKoiosPanelWidth'

// Fire a synthetic keyboard event shape at onHandleKeyDown — only `key` and
// `preventDefault` are read by the handler, so a minimal stub is enough.
function keyEvent(key: string) {
  return { key, preventDefault: () => {} } as unknown as React.KeyboardEvent<HTMLDivElement>
}

describe('useKoiosPanelWidth', () => {
  // A fixed, generous viewport so the 60%-of-window ceiling and the 720px
  // absolute ceiling land on the same number (1200 * 0.6 = 720) — deterministic
  // regardless of which of the two caps the clamp math picks.
  beforeEach(() => {
    localStorage.clear()
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true })
  })
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true })
  })

  // Requirement: a previously chosen width survives a reload.
  it('restores a stored width from localStorage', () => {
    localStorage.setItem('koios.width', '450')
    const { result } = renderHook(() => useKoiosPanelWidth())
    expect(result.current.width).toBe(450)
  })

  // Requirement: a stored width above the viewport-aware ceiling is clamped down.
  it('clamps an out-of-range stored width to the maximum', () => {
    localStorage.setItem('koios.width', '5000')
    const { result } = renderHook(() => useKoiosPanelWidth())
    expect(result.current.width).toBe(720)
    expect(result.current.maxWidth).toBe(720)
  })

  // Requirement: a stored width below the minimum is clamped up, never left broken.
  it('clamps an out-of-range stored width to the minimum', () => {
    localStorage.setItem('koios.width', '10')
    const { result } = renderHook(() => useKoiosPanelWidth())
    expect(result.current.width).toBe(260)
    expect(result.current.minWidth).toBe(260)
  })

  // Requirement: a user who only ever had the old boolean flag keeps a wide
  // panel — the legacy 'true' becomes the known expanded width, not a default.
  it('upgrades a legacy stored boolean (true) to the expanded width', () => {
    localStorage.setItem('koios.expanded', 'true')
    const { result } = renderHook(() => useKoiosPanelWidth())
    expect(result.current.width).toBe(WIDTH_EXPANDED)
  })

  // Same migration, the other direction — a legacy 'false' becomes the
  // collapsed width, not some unrelated default.
  it('upgrades a legacy stored boolean (false) to the collapsed width', () => {
    localStorage.setItem('koios.expanded', 'false')
    const { result } = renderHook(() => useKoiosPanelWidth())
    expect(result.current.width).toBe(WIDTH_COLLAPSED)
  })

  // With no stored value of either kind, the panel still opens at a sane size.
  it('falls back to the collapsed width with nothing stored', () => {
    const { result } = renderHook(() => useKoiosPanelWidth())
    expect(result.current.width).toBe(WIDTH_COLLAPSED)
  })

  // Requirement: the resize handle must be keyboard-operable (§6 WCAG 2.2 AA) —
  // arrow keys step the width, Home/End jump to the min/max bounds.
  it('is keyboard-operable: arrow keys step, Home/End jump to the bounds', () => {
    localStorage.setItem('koios.width', '400')
    const { result } = renderHook(() => useKoiosPanelWidth())
    act(() => result.current.onHandleKeyDown(keyEvent('ArrowRight')))
    expect(result.current.width).toBe(420)
    act(() => result.current.onHandleKeyDown(keyEvent('ArrowLeft')))
    expect(result.current.width).toBe(400)
    act(() => result.current.onHandleKeyDown(keyEvent('Home')))
    expect(result.current.width).toBe(260)
    act(() => result.current.onHandleKeyDown(keyEvent('End')))
    expect(result.current.width).toBe(720)
  })

  // A keyboard step must clamp too — hammering ArrowRight past the ceiling
  // must not overshoot it, exactly like a drag past the edge.
  it('clamps keyboard steps at the maximum', () => {
    localStorage.setItem('koios.width', '710')
    const { result } = renderHook(() => useKoiosPanelWidth())
    act(() => result.current.onHandleKeyDown(keyEvent('ArrowRight')))
    expect(result.current.width).toBe(720)
  })

  // The toggle button still snaps to one of the two known presets — a
  // freely-dragged width resolves via which side of the midpoint it's on.
  it('toggle snaps a dragged width to the nearest known preset', () => {
    localStorage.setItem('koios.width', '400') // below the (300+560)/2=430 midpoint
    const { result } = renderHook(() => useKoiosPanelWidth())
    expect(result.current.isExpanded).toBe(false)
    act(() => result.current.toggle())
    expect(result.current.width).toBe(WIDTH_EXPANDED)
    act(() => result.current.toggle())
    expect(result.current.width).toBe(WIDTH_COLLAPSED)
  })

  // Persistence: a width change is written back under the new numeric key so
  // the NEXT mount reads it directly (no repeated legacy-boolean dependency).
  it('persists a committed width under the new storage key', () => {
    const { result } = renderHook(() => useKoiosPanelWidth())
    act(() => result.current.onHandleKeyDown(keyEvent('ArrowRight')))
    expect(localStorage.getItem('koios.width')).toBe(String(result.current.width))
  })
})
