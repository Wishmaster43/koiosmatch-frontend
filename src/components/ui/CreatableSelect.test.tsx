import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CreatableSelect from './CreatableSelect'

// Build a fake getBoundingClientRect result — only top/bottom matter for the flip math.
const rect = (top: number, bottom: number): DOMRect => ({
  top, bottom, left: 0, right: 200, width: 200, height: bottom - top, x: 0, y: top,
  toJSON: () => ({}),
})

// Flip-to-top (Danny screenshot, kandidaten-ronde-2): a combobox near the bottom
// of a scrollable modal (province/country row) must flip its popover UPWARD
// instead of rendering a downward menu that gets clipped by the modal's own
// `overflow: hidden` and effectively disappears.
describe('CreatableSelect · flip + clamp', () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalRect
  })

  it('opens downward when there is enough room below the anchor', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(100, 130)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    render(<CreatableSelect value={null} onChange={() => {}} options={['A', 'B']} placeholder="Select" />)
    fireEvent.click(screen.getByRole('button'))
    const menu = screen.getByPlaceholderText('Select').closest('div')?.parentElement as HTMLElement
    expect(menu.style.top).toBe('100%')
    expect(menu.style.bottom).toBe('')
  })

  it('flips upward when the anchor sits near the bottom of the viewport', () => {
    HTMLElement.prototype.getBoundingClientRect = () => rect(700, 730)
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 })

    render(<CreatableSelect value={null} onChange={() => {}} options={['A', 'B']} placeholder="Select" />)
    fireEvent.click(screen.getByRole('button'))
    const menu = screen.getByPlaceholderText('Select').closest('div')?.parentElement as HTMLElement
    expect(menu.style.bottom).toBe('100%')
    expect(menu.style.top).toBe('')
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
})
