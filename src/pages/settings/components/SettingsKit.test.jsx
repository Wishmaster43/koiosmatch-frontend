import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectField } from './SettingsKit'

// SelectField is now rewired onto the shared SearchSelect (SETTINGS-KIT-1) instead of a
// bare native <select> — guards that every SchemaSection screen still filters/searches
// and fires onChange with the raw value, with the external prop API unchanged.
describe('SelectField (SearchSelect-backed)', () => {
  const options = [
    { value: 'nl', label: 'Nederland' },
    { value: 'be', label: 'Belgie' },
    { value: 'de', label: 'Duitsland' },
  ]

  it('shows the current selection as the trigger label', () => {
    render(<SelectField value="be" onChange={() => {}} options={options} />)
    expect(screen.getByRole('button', { name: 'Belgie' })).toBeInTheDocument()
  })

  it('opens the dropdown, filters via search, and fires onChange with the picked value', () => {
    const onChange = vi.fn()
    render(<SelectField value="nl" onChange={onChange} options={options} />)
    fireEvent.click(screen.getByRole('button', { name: 'Nederland' }))

    const search = screen.getByPlaceholderText('search')
    fireEvent.change(search, { target: { value: 'duits' } })
    expect(screen.queryByText('Belgie')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Duitsland'))
    expect(onChange).toHaveBeenCalledWith('de')
  })

  it('does not fire onChange when re-picking the already-current value', () => {
    const onChange = vi.fn()
    render(<SelectField value="nl" onChange={onChange} options={options} />)
    fireEvent.click(screen.getByRole('button', { name: 'Nederland' }))
    // Trigger button and the now-open menu option both render the text "Nederland" —
    // the menu option is the one appended later in the DOM (portal content).
    const matches = screen.getAllByText('Nederland')
    fireEvent.click(matches[matches.length - 1])
    expect(onChange).not.toHaveBeenCalled()
  })
})
