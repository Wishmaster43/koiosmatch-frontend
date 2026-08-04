/**
 * LookupChipSelect — thin wiring test: verifies the lookup list reaches
 * ChipMultiSelect (chip renders, click calls onToggle with the raw value) and
 * that the label/hint row renders when passed.
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
  it('renders one chip per lookup item and calls onToggle with the raw value on click', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<LookupChipSelect items={ITEMS} selected={['open']} onToggle={onToggle} />)
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Closed')).toBeInTheDocument()
    await user.click(screen.getByText('Closed'))
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
