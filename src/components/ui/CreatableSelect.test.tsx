import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

// Audit finding (§6, WCAG 2.2 AA): opening moves focus into the search input,
// but on close (pick / Escape / outside click) that input unmounts with the
// portal, so focus used to land nowhere. Covers focus returning to the trigger
// on every close path, and never being stolen from an element the user just
// interacted with (e.g. clicking straight into a different picker's trigger).
describe('CreatableSelect · focus restoration on close', () => {
  it('restores focus to the trigger after picking an option', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CreatableSelect value={null} onChange={onChange} options={['A', 'B']} placeholder="Select" allowCreate={false} />)
    const trigger = screen.getByRole('button', { name: 'Select' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('B')
    expect(trigger).toHaveFocus()
  })

  it('restores focus to the trigger after Escape', async () => {
    const user = userEvent.setup()
    render(<CreatableSelect value={null} onChange={() => {}} options={['A', 'B']} placeholder="Select" allowCreate={false} />)
    const trigger = screen.getByRole('button', { name: 'Select' })
    await user.click(trigger)
    expect(screen.getByPlaceholderText('Select')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })

  // Regression (Danny 28-07): a field seeded with '' (the normal form-state default,
  // e.g. the contact modal's Functie) rendered the empty string instead of the
  // placeholder — the trigger had NO text, so the placeholder never showed and the box
  // collapsed ~8px shorter than the text inputs beside it.
  it('shows the placeholder when the value is an empty string, not blank text', () => {
    render(<CreatableSelect value="" onChange={() => {}} options={['A', 'B']} placeholder="Selecteer" allowCreate={false} />)
    expect(screen.getByRole('button', { name: 'Selecteer' })).toHaveTextContent('Selecteer')
  })

  it('does not steal focus from another element when closed by an outside click', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <CreatableSelect value={null} onChange={() => {}} options={['A', 'B']} placeholder="Select" allowCreate={false} />
        <button>elsewhere</button>
      </div>,
    )
    const trigger = screen.getByRole('button', { name: 'Select' })
    await user.click(trigger)
    const elsewhere = screen.getByRole('button', { name: 'elsewhere' })
    await user.click(elsewhere)
    expect(elsewhere).toHaveFocus()
    expect(trigger).not.toHaveFocus()
  })
})

// VAC-CLEAR-1 (Danny: "gekozen waarde weer leegmaken"): once a value was picked
// there was no way back to empty — the vacancy cascade (klantlocatie/afdeling/
// contactpersoon) and the land/provincie pair are all OPTIONAL, yet a mis-pick
// was permanent. The clear affordance is OPT-IN because this component is shared
// by ~90 call sites: it must be invisible (and layout-neutral) to every caller
// that did not ask for it. No i18n resources are loaded in this suite, so
// react-i18next falls back to the raw key ('clear' / 'clearField') — the same
// convention ConfirmDialog.test.tsx uses.
describe('CreatableSelect · clearable (opt-in)', () => {
  it('sends the EMPTY value to onChange when the clear button is pressed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CreatableSelect value="A" onChange={onChange} options={['A', 'B']} placeholder="Select" allowCreate={false} clearable />)
    await user.click(screen.getByRole('button', { name: 'clear' }))
    // The empty string IS the unset value every caller's form state uses; the
    // vacancy save maps it to `null` in the PATCH body (customer_location_id etc.).
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('does NOT render the clear control when nothing is selected', () => {
    const { rerender } = render(
      <CreatableSelect value={null} onChange={() => {}} options={['A', 'B']} placeholder="Select" allowCreate={false} clearable />,
    )
    expect(screen.queryByRole('button', { name: 'clear' })).not.toBeInTheDocument()
    // '' is the other shape of "unset" (form state seeded with an empty string —
    // the same case that once made the trigger render blank instead of the
    // placeholder); it must not offer a clear either.
    rerender(<CreatableSelect value="" onChange={() => {}} options={['A', 'B']} placeholder="Select" allowCreate={false} clearable />)
    expect(screen.queryByRole('button', { name: 'clear' })).not.toBeInTheDocument()
  })

  it('does not render the clear control at all for a caller that did not opt in', () => {
    render(<CreatableSelect value="A" onChange={() => {}} options={['A', 'B']} placeholder="Select" allowCreate={false} />)
    // The trigger is the ONLY button — no extra control appeared on the ~90
    // existing call sites, and the label reserves no extra room either.
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'clear' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'A' }).querySelector('span')?.style.marginRight).toBe('')
  })

  it('is keyboard reachable and fires on Enter, with a field-specific accessible name', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CreatableSelect value="A" onChange={onChange} options={['A', 'B']} placeholder="Select" allowCreate={false} clearable clearLabel="Provincie" />)
    // Tab order: trigger first, then the clear control (a real sibling <button> —
    // nesting it inside the trigger would drop it from the tab order entirely).
    await user.tab()
    expect(screen.getByRole('button', { name: 'A' })).toHaveFocus()
    await user.tab()
    const clear = screen.getByRole('button', { name: 'clearField' })
    expect(clear).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('closes an open popover when clearing, so the field is not left half-open', async () => {
    const user = userEvent.setup()
    render(<CreatableSelect value="A" onChange={() => {}} options={['A', 'B']} placeholder="Select" allowCreate={false} clearable />)
    await user.click(screen.getByRole('button', { name: 'A' }))
    expect(screen.getByPlaceholderText('Select')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'clear' }))
    expect(screen.queryByPlaceholderText('Select')).not.toBeInTheDocument()
  })
})

// PLAN-KLANTEN K1c: Escape must close the popover immediately after opening,
// while focus is still on the trigger button (not yet moved into the search
// input) — the input's own onKeyDown never sees the key in that window, so the
// document-level capture listener (mirroring SelectMenu) is what has to catch it.
describe('CreatableSelect · Escape closes immediately after opening', () => {
  it('closes on Escape while focus is still on the trigger', () => {
    render(<CreatableSelect value={null} onChange={() => {}} options={['A', 'B']} placeholder="Select" allowCreate={false} />)
    const trigger = screen.getByRole('button', { name: 'Select' })
    fireEvent.click(trigger)
    expect(screen.getByPlaceholderText('Select')).toBeInTheDocument()
    // Dispatched at the document (capture phase), same as a real keydown while
    // the trigger button — not the portalled input — still has focus.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Select')).not.toBeInTheDocument()
  })
})

// The clear button is a sibling of the trigger and the existing close-focus
// effect only restores focus when NOTHING else claimed it — clearing must not
// regress that (the X keeps focus, it is what the user just pressed).
describe('CreatableSelect · clearable does not disturb focus handling', () => {
  it('leaves focus on the clear button after clearing, never yanks it to the trigger', async () => {
    const user = userEvent.setup()
    render(<CreatableSelect value="A" onChange={() => {}} options={['A', 'B']} placeholder="Select" allowCreate={false} clearable />)
    await user.click(screen.getByRole('button', { name: 'A' }))
    const clear = screen.getByRole('button', { name: 'clear' })
    await user.click(clear)
    // The value prop is controlled by the caller, so the X is still rendered here;
    // focus must stay on it rather than jumping back to the trigger.
    expect(screen.getByRole('button', { name: 'clear' })).toHaveFocus()
  })
})
