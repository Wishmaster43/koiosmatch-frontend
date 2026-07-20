import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CreatableSelect from './CreatableSelect'

// Build a fake getBoundingClientRect result — only top/bottom matter for the flip math.
const rect = (top: number, bottom: number): DOMRect => ({
  top, bottom, left: 0, right: 200, width: 200, height: bottom - top, x: 0, y: top,
  toJSON: () => ({}),
})

// Flip + PORTAL (Danny screenshot + live drawer report, kandidaten-ronde-2): a
// combobox near the bottom of a scrollable modal/drawer must flip its popover
// UPWARD, and — since a drawer's own scroll container clips an absolutely
// positioned popover regardless of flip direction or z-index — the popover now
// renders through a PORTAL into document.body with `position: fixed` off the
// anchor's measured rect, escaping any overflow ancestor entirely.
describe('CreatableSelect · flip + clamp + portal', () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalRect
  })

  it('opens downward (fixed at rect.bottom + margin) when there is enough room below the anchor', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(100, 130)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    render(<CreatableSelect value={null} onChange={() => {}} options={['A', 'B']} placeholder="Select" />)
    fireEvent.click(screen.getByRole('button'))
    const menu = screen.getByPlaceholderText('Select').closest('div')?.parentElement as HTMLElement
    // rect.bottom (130) + the 4px gap kept between the anchor and the menu.
    expect(menu.style.top).toBe('134px')
    expect(menu.style.bottom).toBe('')
  })

  it('flips upward (fixed at innerHeight - rect.top + margin) when the anchor sits near the bottom of the viewport', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(700, 730)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    render(<CreatableSelect value={null} onChange={() => {}} options={['A', 'B']} placeholder="Select" />)
    fireEvent.click(screen.getByRole('button'))
    const menu = screen.getByPlaceholderText('Select').closest('div')?.parentElement as HTMLElement
    // innerHeight (800) - rect.top (700) + the 4px gap.
    expect(menu.style.bottom).toBe('104px')
    expect(menu.style.top).toBe('')
  })

  // The actual bug (Danny, live): the drawer's Profiel-tab scroll container is an
  // overflow ancestor that clipped the popover outright — no flip direction or
  // z-index fixes that. Proves the popover escapes it via a portal instead.
  it('renders the popover through a portal into document.body, escaping an overflow ancestor', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(700, 730)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    render(
      <div data-testid="clipper" style={{ overflow: 'hidden', height: 50 }}>
        <CreatableSelect value={null} onChange={() => {}} options={['A', 'B']} placeholder="Select" />
      </div>,
    )
    fireEvent.click(screen.getByRole('button'))
    const clipper = screen.getByTestId('clipper')
    const menu = screen.getByPlaceholderText('Select').closest('div')?.parentElement as HTMLElement
    expect(clipper.contains(menu)).toBe(false)
    expect(menu.parentElement).toBe(document.body)
  })

  // Danny (live, country dropdown): "loopt niet door" — a long list (e.g. the
  // ~249-country list) must stay fully scrollable all the way to the last item,
  // never truncated off by the viewport clamp.
  it('keeps every option reachable (scrollable list, last item present + selectable) in a long list', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(700, 730)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    const onChange = vi.fn()
    const many = Array.from({ length: 200 }, (_, i) => `Option ${i + 1}`)
    render(<CreatableSelect value={null} onChange={onChange} options={many} placeholder="Select" allowCreate={false} />)
    fireEvent.click(screen.getByRole('button'))

    // The scrollable option list is clamped (not the unbounded full-list height)
    // and DOES scroll internally — never removes items from the DOM.
    const list = screen.getByText('Option 1').closest('button')?.parentElement as HTMLElement
    expect(list.style.overflowY).toBe('auto')
    expect(Number(list.style.maxHeight.replace('px', ''))).toBeGreaterThan(0)

    const last = screen.getByRole('button', { name: 'Option 200' })
    fireEvent.click(last)
    expect(onChange).toHaveBeenCalledWith('Option 200')
  })

  // Clicking an option lands inside the PORTAL, not inside the trigger's own
  // wrapping ref — the outside-click check must treat the portal as "inside"
  // too, or the menu would self-close before the pick() handler even fires.
  it('does not treat a click on the portalled menu as an outside click', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(100, 130)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    const onChange = vi.fn()
    render(<CreatableSelect value={null} onChange={onChange} options={['A', 'B']} placeholder="Select" allowCreate={false} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(onChange).toHaveBeenCalledWith('A')
  })
})
