import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SelectAllRow from './SelectAllRow'

// i18n is not initialised in tests, so t() returns the raw key — the label reads
// `multiSelect.selectVisible` / `multiSelect.clearVisible`. The VISIBLE COUNT is a
// separate text node on purpose, so it is assertable (and readable) either way.
const label = () => screen.getByRole('button').textContent

describe('SelectAllRow · scope + state', () => {
  it('renders nothing when no option is visible (no fake affordance)', () => {
    const { container } = render(
      <SelectAllRow visibleValues={[]} selectedValues={[]} onApply={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows how many options the action covers, and applies exactly those', () => {
    const onApply = vi.fn()
    render(<SelectAllRow visibleValues={['a', 'b', 'c']} selectedValues={[]} onApply={onApply} />)

    expect(label()).toContain('multiSelect.selectVisible')
    expect(label()).toContain('3')

    fireEvent.click(screen.getByRole('button'))
    expect(onApply).toHaveBeenCalledWith(['a', 'b', 'c'], true)
  })

  it('only flips the values that are not selected yet (never toggling one back off)', () => {
    const onApply = vi.fn()
    render(<SelectAllRow visibleValues={['a', 'b', 'c']} selectedValues={['b']} onApply={onApply} />)

    // Not all visible values are selected → still "select".
    expect(label()).toContain('multiSelect.selectVisible')
    fireEvent.click(screen.getByRole('button'))
    expect(onApply).toHaveBeenCalledWith(['a', 'c'], true)
  })

  it('flips to "clear" once every VISIBLE value is selected, and clears exactly those', () => {
    const onApply = vi.fn()
    // 'z' is selected but filtered out of view — it must not affect the state or the batch.
    render(<SelectAllRow visibleValues={['a', 'b']} selectedValues={['a', 'b', 'z']} onApply={onApply} />)

    expect(label()).toContain('multiSelect.clearVisible')
    fireEvent.click(screen.getByRole('button'))
    expect(onApply).toHaveBeenCalledWith(['a', 'b'], false)
  })

  it('is a real, keyboard-operable button with an accessible name (§6)', () => {
    const onApply = vi.fn()
    render(<SelectAllRow visibleValues={['a']} selectedValues={[]} onApply={onApply} />)

    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('type', 'button')
    expect(btn.textContent?.trim()).not.toBe('')
    // Enter on a native button dispatches a click — no keyboard trap, no custom handler.
    btn.focus()
    expect(document.activeElement).toBe(btn)
    fireEvent.click(btn)
    expect(onApply).toHaveBeenCalled()
  })

  it('compares values by identity, not by index (numeric option values)', () => {
    const onApply = vi.fn()
    render(<SelectAllRow visibleValues={[1, 2, 3]} selectedValues={[2]} onApply={onApply} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onApply).toHaveBeenCalledWith([1, 3], true)
  })
})
