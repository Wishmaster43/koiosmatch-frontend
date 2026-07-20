import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SearchSelect from './SearchSelect'

// Build a fake getBoundingClientRect result — only top/bottom matter for the flip math.
const rect = (top: number, bottom: number): DOMRect => ({
  top, bottom, left: 0, right: 200, width: 200, height: bottom - top, x: 0, y: top,
  toJSON: () => ({}),
})

// Flip + PORTAL + full scrollability (Danny screenshot + live drawer report,
// kandidaten-ronde-2): the "+ Vestiging" branches picker at the bottom of
// AddCandidateModal opened its popover DOWNWARD and got clipped by the modal's
// own `overflow: hidden`; the drawer's Profiel-tab picker hit the same thing via
// its OWN scroll container, where flipping direction does not help — mirrors
// the CreatableSelect fix: the shared useDropdownPlacement hook plus a PORTAL
// into document.body so the popover escapes any overflow ancestor entirely.
describe('SearchSelect · flip + clamp + portal', () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalRect
  })

  it('opens downward (fixed at rect.bottom + margin) when there is enough room below the trigger', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(100, 130)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    render(<SearchSelect triggerLabel="Vestiging toevoegen" options={['A', 'B']} onToggle={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Vestiging toevoegen/ }))
    const menu = screen.getByPlaceholderText('search').closest('div')?.parentElement as HTMLElement
    // rect.bottom (130) + the 4px gap kept between the anchor and the menu.
    expect(menu.style.top).toBe('134px')
    expect(menu.style.bottom).toBe('')
  })

  it('flips upward (fixed at innerHeight - rect.top + margin) when the trigger sits near the bottom of the viewport (the reported modal case)', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(700, 730)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    render(<SearchSelect triggerLabel="Vestiging toevoegen" options={['A', 'B']} onToggle={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Vestiging toevoegen/ }))
    const menu = screen.getByPlaceholderText('search').closest('div')?.parentElement as HTMLElement
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
        <SearchSelect triggerLabel="Vestiging toevoegen" options={['A', 'B']} onToggle={() => {}} />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Vestiging toevoegen/ }))
    const clipper = screen.getByTestId('clipper')
    const menu = screen.getByPlaceholderText('search').closest('div')?.parentElement as HTMLElement
    expect(clipper.contains(menu)).toBe(false)
    expect(menu.parentElement).toBe(document.body)
  })

  it('keeps every option reachable (scrollable list, last item present + selectable) in a long list', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(700, 730)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    const onToggle = vi.fn()
    const many = Array.from({ length: 200 }, (_, i) => `Option ${i + 1}`)
    render(<SearchSelect triggerLabel="Vestiging toevoegen" options={many} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: /Vestiging toevoegen/ }))

    // The scrollable option list is clamped (not the unbounded full-list height)
    // and DOES scroll internally — never removes items from the DOM.
    const list = screen.getByText('Option 1').parentElement as HTMLElement
    expect(list.style.overflowY).toBe('auto')
    expect(Number(list.style.maxHeight.replace('px', ''))).toBeGreaterThan(0)

    const last = screen.getByRole('button', { name: 'Option 200' })
    fireEvent.click(last)
    expect(onToggle).toHaveBeenCalledWith('Option 200')
  })

  // Clicking an option lands inside the PORTAL, not inside the trigger's own
  // wrapping ref — the outside-click check must treat the portal as "inside"
  // too, or the menu would self-close before onToggle even fires (this would
  // have silently broken multi-select toggling, since SearchSelect never closes
  // itself on a toggle).
  it('does not treat a click on the portalled menu as an outside click', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(100, 130)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    const onToggle = vi.fn()
    render(<SearchSelect triggerLabel="Vestiging toevoegen" options={['A', 'B']} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: /Vestiging toevoegen/ }))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(onToggle).toHaveBeenCalledWith('A')
  })

  it('right-aligns the popover to the anchor\'s right edge (menuAlign="right")', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(100, 130)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1000 })

    render(<SearchSelect triggerLabel="Vestiging toevoegen" options={['A', 'B']} onToggle={() => {}} menuAlign="right" />)
    fireEvent.click(screen.getByRole('button', { name: /Vestiging toevoegen/ }))
    const menu = screen.getByPlaceholderText('search').closest('div')?.parentElement as HTMLElement
    // innerWidth (1000) - rect.right (200, from the shared `rect` fixture above).
    expect(menu.style.right).toBe('800px')
    expect(menu.style.left).toBe('')
  })
})
