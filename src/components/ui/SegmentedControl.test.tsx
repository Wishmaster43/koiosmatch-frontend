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

// Danny 11-08, on the package picker: "waarom zijn de kleuren van de pakketten
// allemaal groen? Alleen het gekozen pakket moet dezelfde kleur groen zijn."
// The §4 default (an inactive option keeps its own weaker tint) is right when each
// option carries its OWN meaning. It is wrong when all options share ONE colour that
// means "this is the active one" — then a faint tint on the rest is simply untrue.
describe('SegmentedControl · activeOnly leaves the unselected options neutral', () => {
  const options = [
    { value: 'core', label: 'Core' },
    { value: 'pro', label: 'Pro' },
    { value: 'enterprise', label: 'Enterprise' },
  ]

  it('tints only the selected option and leaves the others on the neutral surface', () => {
    render(<SegmentedControl options={options} value="pro" onChange={vi.fn()}
      color="var(--color-success)" ariaLabel="Pakket" activeOnly />)

    const chosen = screen.getByRole('radio', { name: /Pro/ })
    const other = screen.getByRole('radio', { name: /Core/ })
    // The chosen one carries the colour…
    expect(chosen.style.background).toContain('color-mix')
    // …and the others carry none of it at all.
    expect(other.style.background).toBe('var(--surface)')
    expect(other.style.borderColor === '' ? other.style.border : other.style.borderColor).toContain('var(--border)')
  })

  // The chosen option must wear the SAME green as every other "this is on" surface
  // (Danny 11-08, exact values: --color-success-bg fill, full --color-success border).
  // Measured, no color-mix percentage reproduces that pastel — the closest, 14%, is
  // visibly off — so an approximation here silently drifts away from the add-on rows
  // and the apps screen. This asserts the token is read, not approximated.
  it('paints the selected option with activeFill and a full-strength border, never a color-mix', () => {
    render(<SegmentedControl options={options} value="pro" onChange={vi.fn()} ariaLabel="Pakket"
                             color="var(--color-success)" activeOnly activeFill="var(--color-success-bg)" />)
    const chosen = screen.getByRole('radio', { name: /Pro/ })
    expect(chosen.style.background).toBe('var(--color-success-bg)')
    expect(chosen.style.border).toBe('1px solid var(--color-success)')
    expect(chosen.style.background).not.toContain('color-mix')
  })

  it('still tints every option WITHOUT activeOnly — the §4 default is unchanged', () => {
    render(<SegmentedControl options={options} value="pro" onChange={vi.fn()}
      color="var(--color-success)" ariaLabel="Pakket" />)
    expect(screen.getByRole('radio', { name: /Core/ }).style.background).toContain('color-mix')
  })

// commitOnFocus=false (Opus batch C finding 1): a selection that triggers an
// audited server write must not fire on every arrow press. Arrows only move
// focus; Enter/Space (the button's native click) commits.
it('with commitOnFocus=false, arrows move focus without selecting; Enter commits', async () => {
  const onChange = vi.fn()
  render(<SegmentedControl ariaLabel="model" commitOnFocus={false} value="a" onChange={onChange}
    options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]} />)
  const first = screen.getByRole('radio', { name: 'A' })
  first.focus()
  fireEvent.keyDown(first, { key: 'ArrowRight' })
  fireEvent.keyDown(screen.getByRole('radio', { name: 'B' }), { key: 'ArrowRight' })
  expect(onChange).not.toHaveBeenCalled() // two arrow presses, zero writes
  fireEvent.click(screen.getByRole('radio', { name: 'C' })) // Enter/Space = native click
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange).toHaveBeenCalledWith('c')
})
})
