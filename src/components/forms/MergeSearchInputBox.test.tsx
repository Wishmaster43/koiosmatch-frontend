/**
 * MergeSearchInputBox — shared duplicate-search input (MergeCustomerModal +
 * MergeEntityModal). Behaviour test: typing reports the raw value via onQueryChange.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MergeSearchInputBox from './MergeSearchInputBox'

describe('MergeSearchInputBox', () => {
  it('renders with the placeholder as both placeholder text and accessible name', () => {
    render(<MergeSearchInputBox query="" onQueryChange={vi.fn()} placeholder="Zoek klant" inputStyle={{}} />)
    expect(screen.getByPlaceholderText('Zoek klant')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Zoek klant' })).toBeInTheDocument()
  })

  it('typing calls onQueryChange with the new value', async () => {
    const onQueryChange = vi.fn()
    const user = userEvent.setup()
    render(<MergeSearchInputBox query="" onQueryChange={onQueryChange} placeholder="Zoek klant" inputStyle={{}} />)
    await user.type(screen.getByPlaceholderText('Zoek klant'), 'a')
    expect(onQueryChange).toHaveBeenCalledWith('a')
  })

  it('is autofocused', () => {
    render(<MergeSearchInputBox query="" onQueryChange={vi.fn()} placeholder="Zoek klant" inputStyle={{}} />)
    expect(screen.getByPlaceholderText('Zoek klant')).toHaveFocus()
  })
})
