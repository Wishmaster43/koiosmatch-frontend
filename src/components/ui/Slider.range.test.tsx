/**
 * Slider — RANGE mode (Danny 08-08, point 8): the shared slider grew a second
 * thumb instead of the candidate-side Match-zoeker growing a private one (§11:
 * extend the shared component, never fork it). Proves both thumbs are independent,
 * keyboard-operable and mutually clamped, and that the ORIGINAL single-thumb
 * contract is untouched. jsdom reports a zero-width bounding box for every element,
 * so pointer dragging cannot be simulated here — the arrow-key path drives the same
 * state transition and is the accessible one (§6).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Slider from './Slider'

describe('Slider · range mode (two thumbs)', () => {
  it('renders one thumb per bound, each with its own accessible name and value', () => {
    render(<Slider range={[10, 30]} max={40} onRangeChange={vi.fn()} ariaLabels={['Min', 'Max']} />)

    const lower = screen.getByRole('slider', { name: 'Min' })
    const upper = screen.getByRole('slider', { name: 'Max' })
    expect(lower).toHaveAttribute('aria-valuenow', '10')
    expect(upper).toHaveAttribute('aria-valuenow', '30')
    // Each thumb advertises the OTHER one as its bound, so a screen reader
    // announces the real operating range, not the full domain.
    expect(lower).toHaveAttribute('aria-valuemax', '30')
    expect(upper).toHaveAttribute('aria-valuemin', '10')
  })

  it('an arrow key moves ONLY the focused thumb, emitting the whole range', () => {
    const onRangeChange = vi.fn()
    render(<Slider range={[10, 30]} max={40} step={2} onRangeChange={onRangeChange} ariaLabels={['Min', 'Max']} />)

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Min' }), { key: 'ArrowRight' })
    expect(onRangeChange).toHaveBeenLastCalledWith([12, 30])

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Max' }), { key: 'ArrowLeft' })
    expect(onRangeChange).toHaveBeenLastCalledWith([10, 28])
  })

  it('clamps each thumb at its neighbour and at the domain ends — never a crossed range', () => {
    const onRangeChange = vi.fn()
    const { rerender } = render(<Slider range={[30, 30]} max={40} onRangeChange={onRangeChange} ariaLabels={['Min', 'Max']} />)

    // Lower thumb cannot climb past the upper one.
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Min' }), { key: 'ArrowRight' })
    expect(onRangeChange).toHaveBeenLastCalledWith([30, 30])

    // Upper thumb cannot drop below the lower one.
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Max' }), { key: 'ArrowLeft' })
    expect(onRangeChange).toHaveBeenLastCalledWith([30, 30])

    // Domain ends hold too (0 on the left, max on the right).
    rerender(<Slider range={[0, 40]} max={40} onRangeChange={onRangeChange} ariaLabels={['Min', 'Max']} />)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Min' }), { key: 'ArrowLeft' })
    expect(onRangeChange).toHaveBeenLastCalledWith([0, 40])
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Max' }), { key: 'ArrowRight' })
    expect(onRangeChange).toHaveBeenLastCalledWith([0, 40])
  })

  it('a key that is not an arrow changes nothing', () => {
    const onRangeChange = vi.fn()
    render(<Slider range={[10, 30]} max={40} onRangeChange={onRangeChange} ariaLabels={['Min', 'Max']} />)

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Min' }), { key: 'Enter' })
    expect(onRangeChange).not.toHaveBeenCalled()
  })
})

describe('Slider · single mode (unchanged contract)', () => {
  it('still renders ONE thumb driven by value/onChange', () => {
    const onChange = vi.fn()
    render(<Slider value={20} max={40} step={5} onChange={onChange} ariaLabel="Gewicht" />)

    expect(screen.getAllByRole('slider')).toHaveLength(1)
    const thumb = screen.getByRole('slider', { name: 'Gewicht' })
    expect(thumb).toHaveAttribute('aria-valuenow', '20')

    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(25)
    fireEvent.keyDown(thumb, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith(15)
  })
})
