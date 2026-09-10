import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { useClickOutside } from './useClickOutside'
import { DROPDOWN_PORTAL_ATTR } from '@/lib/useDropdownPlacement'

// Spies on addEventListener/removeEventListener('mousedown', ...) calls only.
function spyOnMousedownListeners() {
  const add = vi.spyOn(document, 'addEventListener')
  const remove = vi.spyOn(document, 'removeEventListener')
  const countMousedown = (spy: typeof add) => spy.mock.calls.filter(c => c[0] === 'mousedown').length
  return { add, remove, countMousedown }
}

// Renders a trigger div + a "portal" div NOT nested inside it (mirrors
// SelectMenu/CreatableSelect/SearchSelect's createPortal case), and asserts
// the hook's outside-click detection against both.
function setup(enabled: boolean, onOutside: () => void) {
  const triggerRef = createRef<HTMLDivElement>()
  const portalRef = createRef<HTMLDivElement>()
  const trigger = document.createElement('div')
  const portal = document.createElement('div')
  document.body.appendChild(trigger)
  document.body.appendChild(portal)
  triggerRef.current = trigger
  portalRef.current = portal
  renderHook(() => useClickOutside([triggerRef, portalRef], enabled, onOutside))
  return { trigger, portal }
}

describe('useClickOutside', () => {
  it('fires onOutside on a mousedown outside every tracked ref', () => {
    const onOutside = vi.fn()
    setup(true, onOutside)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onOutside).toHaveBeenCalledTimes(1)
  })

  it('does not fire when the click lands on the trigger ref', () => {
    const onOutside = vi.fn()
    const { trigger } = setup(true, onOutside)
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onOutside).not.toHaveBeenCalled()
  })

  it('treats the portal ref as INSIDE too (picking an option must not self-close first)', () => {
    const onOutside = vi.fn()
    const { portal } = setup(true, onOutside)
    portal.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onOutside).not.toHaveBeenCalled()
  })

  it('does nothing while disabled', () => {
    const onOutside = vi.fn()
    setup(false, onOutside)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onOutside).not.toHaveBeenCalled()
  })

  it('subscribes once per `enabled` toggle, not once per render, even with fresh refs/callback literals each time', () => {
    const { add, remove, countMousedown } = spyOnMousedownListeners()
    const triggerRef = createRef<HTMLDivElement>()
    triggerRef.current = document.createElement('div')
    // Every call site passes a fresh array literal and a fresh arrow — mirror
    // that here so the test proves the hook itself latches, not the caller.
    const { rerender } = renderHook(
      ({ n }) => useClickOutside([triggerRef], true, () => n),
      { initialProps: { n: 0 } }
    )
    expect(countMousedown(add)).toBe(1)
    rerender({ n: 1 })
    rerender({ n: 2 })
    expect(countMousedown(add)).toBe(1)
    expect(countMousedown(remove)).toBe(0)
    add.mockRestore()
    remove.mockRestore()
  })

  // DRY round 11, CANDTABS: PoolsSection/DashboardSwitcher both hand-rolled this
  // exact "ignore a click inside ANY portalled dropdown menu" guard before adopting
  // the shared hook — the option must keep that behaviour identical.
  it('with ignoreDropdownPortal, treats a click inside ANY dropdown-portal-marked node as inside too, even outside every tracked ref', () => {
    const onOutside = vi.fn()
    const triggerRef = createRef<HTMLDivElement>()
    triggerRef.current = document.createElement('div')
    document.body.appendChild(triggerRef.current)
    const otherPortal = document.createElement('div')
    otherPortal.setAttribute(DROPDOWN_PORTAL_ATTR, '')
    document.body.appendChild(otherPortal)
    renderHook(() => useClickOutside([triggerRef], true, onOutside, { ignoreDropdownPortal: true }))
    otherPortal.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onOutside).not.toHaveBeenCalled()
    triggerRef.current.remove(); otherPortal.remove()
  })

  it('without ignoreDropdownPortal, a click inside a dropdown-portal-marked node that is not a tracked ref still fires onOutside', () => {
    const onOutside = vi.fn()
    const triggerRef = createRef<HTMLDivElement>()
    triggerRef.current = document.createElement('div')
    document.body.appendChild(triggerRef.current)
    const otherPortal = document.createElement('div')
    otherPortal.setAttribute(DROPDOWN_PORTAL_ATTR, '')
    document.body.appendChild(otherPortal)
    renderHook(() => useClickOutside([triggerRef], true, onOutside))
    otherPortal.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onOutside).toHaveBeenCalledTimes(1)
    triggerRef.current.remove(); otherPortal.remove()
  })
})
