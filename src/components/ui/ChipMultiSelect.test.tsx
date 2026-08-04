import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChipMultiSelect from './ChipMultiSelect'

// Soft-chip multiselect replacing raw checkbox lookup-selection — guards toggling
// and aria-pressed, plus the legacy `selected` alias existing call sites still use.
describe('ChipMultiSelect', () => {
  const options = [
    { value: 'mon', label: 'Monday' },
    { value: 'tue', label: 'Tuesday' },
  ]

  it('toggles a chip and reports aria-pressed', () => {
    const onToggle = vi.fn()
    render(<ChipMultiSelect options={options} values={['mon']} onToggle={onToggle} />)
    const mon = screen.getByRole('button', { name: 'Monday' })
    const tue = screen.getByRole('button', { name: 'Tuesday' })
    expect(mon).toHaveAttribute('aria-pressed', 'true')
    expect(tue).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(tue)
    expect(onToggle).toHaveBeenCalledWith('tue')
  })

  it('accepts the legacy `selected` prop alias unchanged', () => {
    render(<ChipMultiSelect options={options} selected={['tue']} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'Tuesday' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders the empty-state text when there are no options', () => {
    render(<ChipMultiSelect options={[]} values={[]} onToggle={() => {}} emptyText="No options" />)
    expect(screen.getByText('No options')).toBeInTheDocument()
  })
})
