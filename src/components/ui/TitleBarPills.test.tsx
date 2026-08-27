// Atom smoke test: renders every option, marks the active pill pressed + bold,
// and only draws a leading dot when the option carries a colour.
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TitleBarPills from './TitleBarPills'

describe('TitleBarPills', () => {
  it('renders one pill per option and reflects the active value', () => {
    render(<TitleBarPills ariaLabel="Phase" value="candidate" onChange={vi.fn()}
      options={[{ value: 'lead', label: 'Lead' }, { value: 'candidate', label: 'Candidate' }]} />)
    const active = screen.getByRole('button', { name: 'Candidate' })
    const inactive = screen.getByRole('button', { name: 'Lead' })
    expect(active).toHaveAttribute('aria-pressed', 'true')
    expect(inactive).toHaveAttribute('aria-pressed', 'false')
    // fontWeight lives on the inner label span, not the button element itself.
    expect(active.querySelector('span')).toHaveStyle({ fontWeight: 600 })
  })

  it('draws a colour dot only when the option carries a colour', () => {
    const { container } = render(<TitleBarPills ariaLabel="Status" value="open" onChange={vi.fn()}
      // eslint-disable-next-line no-restricted-syntax -- test fixture DATA (a lookup's own colour), not a styled surface
      options={[{ value: 'open', label: 'Open', color: '#22c55e' }, { value: 'closed', label: 'Closed' }]} />)
    // The dot is a bare 8x8 rounded div rendered only for the coloured option.
    const dots = container.querySelectorAll('div[style*="border-radius: 50%"]')
    expect(dots.length).toBe(1)
  })

  it('calls onChange with the picked value', () => {
    const onChange = vi.fn()
    render(<TitleBarPills ariaLabel="Type" value="" onChange={onChange}
      options={[{ value: 'a', label: 'A' }]} />)
    screen.getByRole('button', { name: 'A' }).click()
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('clears on re-click only when clearable', () => {
    const onChange = vi.fn()
    render(<TitleBarPills ariaLabel="Contract form" value="freelance" onChange={onChange} clearable
      options={[{ value: 'freelance', label: 'Freelance' }]} />)
    screen.getByRole('button', { name: 'Freelance' }).click()
    expect(onChange).toHaveBeenCalledWith('')
  })
})
