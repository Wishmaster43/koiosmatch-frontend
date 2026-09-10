/**
 * Test for useDropdownPopover: verifies the composed wiring actually behaves —
 * a click inside the returned menuRef never closes the menu (the reason the
 * portalled menu ref must count as "inside" too), while a click outside both
 * the anchor and the menu does — the exact bug class DUP-03 exists to catch.
 */
import { describe, test, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { useDropdownPopover } from './useDropdownPopover'

describe('useDropdownPopover', () => {
  test('closes on an outside click but not on a click inside the menu ref', () => {
    const anchor = document.createElement('div')
    const menu = document.createElement('div')
    const outside = document.createElement('div')
    document.body.append(anchor, menu, outside)
    let closeCount = 0

    const { result } = renderHook(() => {
      const anchorRef = useRef<HTMLDivElement>(anchor)
      const popover = useDropdownPopover(anchorRef, true, () => { closeCount += 1 }, () => null)
      // Attach the returned menuRef to a real portal-like node so the
      // click-outside check treats it as "inside", mirroring the three consumers.
      popover.menuRef.current = menu
      return popover
    })
    expect(result.current.menuRef.current).toBe(menu)

    // A click inside the menu must NOT close it.
    menu.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(closeCount).toBe(0)

    // A click outside both the anchor and the menu closes it.
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(closeCount).toBe(1)

    document.body.removeChild(anchor)
    document.body.removeChild(menu)
    document.body.removeChild(outside)
  })
})
