import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SearchSelect from './SearchSelect'

// Build a fake getBoundingClientRect result — only top/bottom matter for the flip math.
const rect = (top: number, bottom: number): DOMRect => ({
  top, bottom, left: 0, right: 200, width: 200, height: bottom - top, x: 0, y: top,
  toJSON: () => ({}),
})

// Flip-to-top + full scrollability (Danny screenshot, kandidaten-ronde-2): the
// "+ Vestiging" branches picker at the bottom of AddCandidateModal opened its
// popover DOWNWARD and got clipped by the modal's own `overflow: hidden` —
// mirrors the CreatableSelect fix via the shared useDropdownPlacement hook.
describe('SearchSelect · flip + clamp', () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalRect
  })

  it('opens downward when there is enough room below the trigger', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(100, 130)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    render(<SearchSelect triggerLabel="Vestiging toevoegen" options={['A', 'B']} onToggle={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Vestiging toevoegen/ }))
    const menu = screen.getByPlaceholderText('search').closest('div')?.parentElement as HTMLElement
    expect(menu.style.top).toBe('100%')
    expect(menu.style.bottom).toBe('')
  })

  it('flips upward when the trigger sits near the bottom of the viewport (the reported modal case)', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(700, 730)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    render(<SearchSelect triggerLabel="Vestiging toevoegen" options={['A', 'B']} onToggle={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Vestiging toevoegen/ }))
    const menu = screen.getByPlaceholderText('search').closest('div')?.parentElement as HTMLElement
    expect(menu.style.bottom).toBe('100%')
    expect(menu.style.top).toBe('')
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
})
