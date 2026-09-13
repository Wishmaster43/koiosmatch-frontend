/**
 * SettingsTabs (SETTINGS-TABS-OVERFLOW-1, Danny 30-08): the group tab row must
 * stay usable when there are more tabs than fit — scrollable, the active tab
 * scrolled into view on mount/change, edge fades signalling more content.
 */
import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import '@/i18n'
import SettingsTabs from './SettingsTabs'

// jsdom has no real layout engine — scrollIntoView does not exist at all, and
// scroll/client/scrollWidth read back as 0 by default. A permanent baseline
// no-op is installed once (module scope) so vi.spyOn always has a real method
// to wrap; each test spies + mockRestore()s in a finally (verdict finding 5 —
// mirror KoiosCapabilitiesCard.test.tsx's scrollHeight/clientHeight spies)
// instead of overwriting the prototype directly and leaving it unrestored.
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {}
}
const items = [
  { id: 'apps', icon: null }, { id: 'usage', icon: null }, { id: 'koios_models', icon: null },
  { id: 'admin_jobs', icon: null }, { id: 'admin_invoice_settings', icon: null },
  { id: 'admin_invoices', icon: null }, { id: 'modules', icon: null },
]

describe('SettingsTabs · overflow handling', () => {
  it('renders a scrollable tablist, keeps tab text full-width, and brings the active tab into view', () => {
    const scrollIntoViewSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    try {
      render(<SettingsTabs items={items} active="admin_invoices" onSelect={vi.fn()} />)

      const tablist = screen.getByRole('tablist')
      expect(tablist.style.overflowX).toBe('auto')
      // Every tab keeps its full text width — never wraps or shrinks below it.
      screen.getAllByRole('tab').forEach((tab) => expect(tab).toHaveStyle({ whiteSpace: 'nowrap' }))
      // The active tab was asked to scroll itself into view (mount included).
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    } finally {
      scrollIntoViewSpy.mockRestore()
    }
  })

  it('shows only the right-edge fade when scrolled to the start of an overflowing row', () => {
    const scrollIntoViewSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    try {
      const { container } = render(<SettingsTabs items={items} active="apps" onSelect={vi.fn()} />)
      const tablist = container.querySelector('[role="tablist"]')

      // Simulate an overflowing row, scrolled all the way to the start.
      Object.defineProperty(tablist, 'scrollWidth', { configurable: true, value: 900 })
      Object.defineProperty(tablist, 'clientWidth', { configurable: true, value: 300 })
      Object.defineProperty(tablist, 'scrollLeft', { configurable: true, value: 0 })
      act(() => { tablist.dispatchEvent(new Event('scroll')) })

      expect(screen.queryByTestId('settings-tabs-edge-left')).not.toBeInTheDocument()
      expect(screen.getByTestId('settings-tabs-edge-right')).toBeInTheDocument()
    } finally {
      scrollIntoViewSpy.mockRestore()
    }
  })

  it('renders nothing at all for a single-item category (existing short-circuit preserved)', () => {
    const { container } = render(<SettingsTabs items={[items[0]]} active="apps" onSelect={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('paints an item icon in its own palette colour, falling back to the group colour, then inheriting', () => {
    const Bell = (props) => <svg data-testid="icon-bell" {...props} />
    const paletteItems = [
      { id: 'a', icon: Bell }, { id: 'b', icon: Bell }, { id: 'c', icon: Bell },
    ]
    const itemOf = (groupKey, id) => (id === 'a' ? { color: 'var(--color-danger-text)' } : undefined)
    const colorOf = () => 'var(--color-info)'
    render(<SettingsTabs items={paletteItems} active="a" onSelect={vi.fn()} groupKey="notifications" colorOf={colorOf} itemOf={itemOf} />)
    const icons = screen.getAllByTestId('icon-bell')
    // Item 'a' has its own colour; 'b'/'c' fall back to the group colour.
    expect(icons[0].style.color).toBe('var(--color-danger-text)')
    expect(icons[1].style.color).toBe('var(--color-info)')
    // With neither an item nor a group colour, the icon inherits (unset), never a hardcoded grey.
    const { container: bare } = render(<SettingsTabs items={paletteItems} active="a" onSelect={vi.fn()} groupKey="notifications" colorOf={() => undefined} itemOf={() => undefined} />)
    expect(bare.querySelector('svg').style.color).toBe('')
  })

  it('resolves a BE-declared icon name over the registry icon, and never recolours the icon on hover', () => {
    const RegistryIcon = (props) => <svg data-testid="icon-registry" {...props} />
    const itemOf = () => ({ icon: 'mail', color: 'var(--color-info)' })
    render(<SettingsTabs items={[{ id: 'a', icon: RegistryIcon }, { id: 'b', icon: RegistryIcon }]} active="b" onSelect={vi.fn()} groupKey="communication" colorOf={() => undefined} itemOf={itemOf} />)
    // The registry icon is replaced by the resolved lucide icon (Mail), not the fallback.
    expect(screen.queryByTestId('icon-registry')).not.toBeInTheDocument()
    const inactiveTab = screen.getAllByRole('tab')[0]
    const icon = inactiveTab.querySelector('svg')
    expect(icon.style.color).toBe('var(--color-info)')
    fireEvent.mouseEnter(inactiveTab)
    // Hover recolours only the label text (existing behaviour), never the icon.
    expect(icon.style.color).toBe('var(--color-info)')
  })

  it('re-scrolls the active tab into view on a viewport resize, not only on mount/change (verdict finding 3)', () => {
    const scrollIntoViewSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    let resizeCallback
    const observe = vi.fn()
    const disconnect = vi.fn()
    const originalRO = globalThis.ResizeObserver
    // Stub ResizeObserver so the test can fire its callback deliberately —
    // jsdom has no real resize signal to dispatch.
    globalThis.ResizeObserver = class {
      constructor(cb) { resizeCallback = cb }
      observe = observe
      disconnect = disconnect
    }
    try {
      render(<SettingsTabs items={items} active="admin_invoices" onSelect={vi.fn()} />)
      expect(observe).toHaveBeenCalled()
      scrollIntoViewSpy.mockClear()

      // Simulate the ResizeObserver firing on a viewport/sidebar resize.
      act(() => { resizeCallback() })

      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    } finally {
      scrollIntoViewSpy.mockRestore()
      globalThis.ResizeObserver = originalRO
    }
  })
})
