import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SubTabBar from './SubTabBar'

// jsdom has no scrollIntoView at all — install a permanent no-op baseline once
// (module scope) so vi.spyOn always has a real method to wrap; each test spies
// + mockRestore()s in a finally (mirrors SettingsTabs.test.jsx).
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {}
}

const tabs = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Charlie' },
]

// SubTabBar is purely presentational (§3A) — this harness owns `active` exactly
// like a real host (EntityDrawer / a tab component) would.
function Host({ initial = 'a' }: { initial?: string }) {
  const [active, setActive] = useState(initial)
  return <SubTabBar tabs={tabs} active={active} onChange={setActive} />
}

// Audit finding (§6, WCAG 2.2 AA): SubTabBar declared role="tablist"/"tab" +
// aria-selected but implemented no arrow-key navigation — a screen reader was
// told "tab strip" while arrow keys did nothing. Covers the full WAI-ARIA tabs
// keyboard model (roving tabindex + Left/Right/Home/End, wrapping at the ends).
describe('SubTabBar · tablist keyboard model (§6 WCAG 2.2 AA)', () => {
  it('exposes tab/tablist roles with aria-selected following the active tab', () => {
    render(<Host />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Bravo' })).toHaveAttribute('aria-selected', 'false')
  })

  it('roving tabindex: only the active tab sits in the natural Tab order', () => {
    render(<Host />)
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Bravo' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tab', { name: 'Charlie' })).toHaveAttribute('tabindex', '-1')
  })

  it('ArrowRight moves focus and selection to the next tab', async () => {
    const user = userEvent.setup()
    render(<Host />)
    screen.getByRole('tab', { name: 'Alpha' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Bravo' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Bravo' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'false')
  })

  it('ArrowLeft wraps from the first tab to the last', async () => {
    const user = userEvent.setup()
    render(<Host />)
    screen.getByRole('tab', { name: 'Alpha' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Charlie' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Charlie' })).toHaveFocus()
  })

  it('ArrowRight wraps from the last tab to the first', async () => {
    const user = userEvent.setup()
    render(<Host initial="c" />)
    screen.getByRole('tab', { name: 'Charlie' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
  })

  it('End jumps to the last tab, Home jumps back to the first', async () => {
    const user = userEvent.setup()
    render(<Host />)
    screen.getByRole('tab', { name: 'Alpha' }).focus()
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Charlie' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
  })
})

// KOIOS-TOOL-MATRIX-FE-3 verdict finding 1: a 12-tab domain strip clipped 6
// tabs at 1440 with zero cue — SubTabBar never got the overflow treatment
// SettingsTabs grew the same day. Covers the shared useTabStripOverflow hook
// wired into SubTabBar: active-tab scroll-into-view on change, and again on a
// ResizeObserver fire (narrow-container case).
describe('SubTabBar · overflow handling (narrow container)', () => {
  it('scrolls the active tab into view when the active tab changes', () => {
    const scrollIntoViewSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    try {
      const { rerender } = render(<SubTabBar tabs={tabs} active="a" onChange={() => {}} />)
      scrollIntoViewSpy.mockClear()
      rerender(<SubTabBar tabs={tabs} active="c" onChange={() => {}} />)
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    } finally {
      scrollIntoViewSpy.mockRestore()
    }
  })

  it('re-scrolls the active tab into view on a ResizeObserver fire (narrow container)', () => {
    const scrollIntoViewSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    let resizeCallback: (() => void) | undefined
    const observe = vi.fn()
    const disconnect = vi.fn()
    const originalRO = globalThis.ResizeObserver
    // Stub ResizeObserver so the test can fire its callback deliberately —
    // jsdom has no real resize signal to dispatch.
    globalThis.ResizeObserver = class {
      constructor(cb: () => void) { resizeCallback = cb }
      observe = observe
      disconnect = disconnect
    } as unknown as typeof ResizeObserver
    try {
      render(<SubTabBar tabs={tabs} active="c" onChange={() => {}} />)
      expect(observe).toHaveBeenCalled()
      scrollIntoViewSpy.mockClear()

      // Simulate the ResizeObserver firing on a container width change
      // (narrow container: the active tab may have fallen out of view).
      act(() => { resizeCallback?.() })

      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    } finally {
      scrollIntoViewSpy.mockRestore()
      globalThis.ResizeObserver = originalRO
    }
  })
})
