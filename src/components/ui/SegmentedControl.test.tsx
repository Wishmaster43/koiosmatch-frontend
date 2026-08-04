import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SegmentedControl from './SegmentedControl'

// Option-card group replacing hand-rolled radios — guards radiogroup semantics,
// keyboard arrow navigation and the click path.
describe('SegmentedControl', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
    { value: 'c', label: 'Option C' },
  ]

  it('renders a radiogroup with the active option checked', () => {
    render(<SegmentedControl options={options} value="b" onChange={() => {}} ariaLabel="Pick one" />)
    expect(screen.getByRole('radiogroup', { name: 'Pick one' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Option B/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Option A/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('fires onChange on click', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={options} value="a" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /Option C/ }))
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('moves selection with ArrowRight/ArrowLeft (roving keyboard support)', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={options} value="a" onChange={onChange} />)
    const first = screen.getByRole('radio', { name: /Option A/ })
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('b')

    onChange.mockClear()
    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('c')
  })
})
