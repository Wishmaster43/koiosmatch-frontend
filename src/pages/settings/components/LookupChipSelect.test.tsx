/**
 * LookupChipSelect — thin wiring test: one row per lookup value with a soft
 * colour chip + a real Toggle switch ("Toggle maken!!", Danny 2026-08-05);
 * toggling calls onToggle with the raw value; label/hint row renders when passed.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LookupChipSelect from './LookupChipSelect'

const ITEMS = [
  { value: 'open', label: 'Open', color: '#79B58E' },
  { value: 'closed', label: 'Closed', color: '#DDA071' },
]

describe('LookupChipSelect', () => {
  it('renders one Toggle switch per lookup item, reflecting the selected state', () => {
    render(<LookupChipSelect items={ITEMS} selected={['open']} onToggle={() => {}} />)
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(2)
    expect(screen.getByRole('switch', { name: 'Open' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Closed' })).toHaveAttribute('aria-checked', 'false')
  })

  it('flipping a switch calls onToggle with the raw lookup value', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<LookupChipSelect items={ITEMS} selected={['open']} onToggle={onToggle} />)
    await user.click(screen.getByRole('switch', { name: 'Closed' }))
    expect(onToggle).toHaveBeenCalledWith('closed')
  })

  it('renders the label + hint row only when provided', () => {
    const { rerender } = render(<LookupChipSelect items={ITEMS} selected={[]} onToggle={() => {}} label="My label" hint="My hint" />)
    expect(screen.getByText('My label')).toBeInTheDocument()
    expect(screen.getByText('My hint')).toBeInTheDocument()
    rerender(<LookupChipSelect items={ITEMS} selected={[]} onToggle={() => {}} />)
    expect(screen.queryByText('My label')).not.toBeInTheDocument()
  })
})
