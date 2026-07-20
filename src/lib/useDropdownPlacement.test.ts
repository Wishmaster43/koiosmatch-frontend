import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { useDropdownPlacement } from './useDropdownPlacement'

// Build a fake getBoundingClientRect result — only top/bottom matter for the flip math.
const rect = (top: number, bottom: number): DOMRect => ({
  top, bottom, left: 0, right: 200, width: 200, height: bottom - top, x: 0, y: top,
  toJSON: () => ({}),
})

// The ONE shared flip + clamp math behind CreatableSelect and SearchSelect
// (CLAUDE.md §11: never two copies of this logic) — covered directly here so a
// regression in the shared hook fails once, not twice per consumer.
describe('useDropdownPlacement', () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalRect
  })

  it('stays closed-down (openUp=false) with plenty of room below', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(100, 130)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(document.createElement('div'))
      return useDropdownPlacement(ref, true)
    })
    expect(result.current.openUp).toBe(false)
    expect(result.current.maxHeight).toBe(240) // full cap — plenty of space below
  })

  it('flips up and clamps to the space above when the anchor sits near the bottom', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(700, 730)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(document.createElement('div'))
      return useDropdownPlacement(ref, true)
    })
    expect(result.current.openUp).toBe(true)
    expect(result.current.maxHeight).toBe(240) // plenty of room above too, still capped at 240
  })

  it('never measures while closed (keeps the default placement)', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(700, 730)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(document.createElement('div'))
      return useDropdownPlacement(ref, false)
    })
    expect(result.current.openUp).toBe(false)
  })
})
