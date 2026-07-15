/**
 * EditableFieldTable · the 'address' composite type (Danny 2026-07-14): read mode
 * composes ONE line (street+no+suffix, postcode+city — mirrors the candidate
 * ProfileTab addressRow), editing expands it into its declared `addressFields`
 * loose child rows, and saving hands back a flat object (no nested 'address' key).
 * Also checks a plain sibling field (text + checkbox) is unaffected by that logic.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditableFieldTable from './EditableFieldTable'
import type { FieldRow } from './EditableFieldTable'

// EditableFieldTable pulls in useDateFormat for its 'date' field type, which
// transitively imports the real @/i18n setup and initialises it for real (Dutch
// resources) — stub it so t() stays on raw keys, like every other test in this repo.
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))

// The address composite — a fixed shape shared by every 'address' row in the app.
const addressFields: FieldRow[] = [
  { key: 'street', label: 'Street' },
  { key: 'houseNumber', label: 'House number' },
  { key: 'houseNumberSuffix', label: 'Suffix' },
  { key: 'postalCode', label: 'Postal code' },
  { key: 'city', label: 'City' },
]
const fields: FieldRow[] = [
  { key: 'address', label: 'Address', type: 'address', addressFields },
  { key: 'phone', label: 'Phone' },
  { key: 'isHq', label: 'Headquarters', type: 'checkbox' },
]
const value = {
  street: 'Kerkstraat', houseNumber: '12', houseNumberSuffix: 'a',
  postalCode: '1234 AB', city: 'Amsterdam', phone: '0612345678', isHq: true,
}

describe('EditableFieldTable · address composite (read mode)', () => {
  it('composes one line: "street houseNumber-suffix, postcode city"', () => {
    render(<EditableFieldTable fields={fields} value={value} />)
    expect(screen.getByText('Kerkstraat 12-a, 1234 AB Amsterdam')).toBeInTheDocument()
  })

  it('does not render the loose child field labels in read mode', () => {
    render(<EditableFieldTable fields={fields} value={value} />)
    expect(screen.queryByText('Street')).toBeNull()
    expect(screen.queryByText('Postal code')).toBeNull()
  })

  it('falls back to a dash when every address part is empty', () => {
    render(<EditableFieldTable fields={fields} value={{ phone: '0612345678' }} />)
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('does not disturb a sibling plain/checkbox field', () => {
    render(<EditableFieldTable fields={fields} value={value} />)
    expect(screen.getByText('0612345678')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
  })
})

describe('EditableFieldTable · address composite (edit mode)', () => {
  it('expands into the loose addressFields once editing starts', async () => {
    const user = userEvent.setup()
    render(<EditableFieldTable fields={fields} value={value} />)
    await user.click(screen.getByTitle('edit'))
    // The composed line is gone; each declared child field is now its own row.
    expect(screen.queryByText('Kerkstraat 12-a, 1234 AB Amsterdam')).toBeNull()
    expect(screen.getByText('Street')).toBeInTheDocument()
    expect(screen.getByText('House number')).toBeInTheDocument()
    expect(screen.getByText('Suffix')).toBeInTheDocument()
    expect(screen.getByText('Postal code')).toBeInTheDocument()
    expect(screen.getByText('City')).toBeInTheDocument()
    // Loose inputs are pre-filled from the shared values object.
    expect(screen.getByDisplayValue('Kerkstraat')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1234 AB')).toBeInTheDocument()
  })

  it('collapses back to one composed line and does not carry a nested "address" key on save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditableFieldTable fields={fields} value={value} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    const street = screen.getByDisplayValue('Kerkstraat')
    await user.clear(street)
    await user.type(street, 'Nieuwstraat')
    await user.click(screen.getByTitle('save'))

    // Back to read mode: one composed line, using the edited street.
    expect(screen.getByText('Nieuwstraat 12-a, 1234 AB Amsterdam')).toBeInTheDocument()
    // The saved payload is flat — the child keys changed, no 'address' key was introduced.
    const saved = onSave.mock.calls[0][0]
    expect(saved.street).toBe('Nieuwstraat')
    expect(saved.address).toBeUndefined()
    expect(saved.city).toBe('Amsterdam')
  })

  it('cancel restores the original composed line without saving', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditableFieldTable fields={fields} value={value} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    const street = screen.getByDisplayValue('Kerkstraat')
    await user.clear(street)
    await user.type(street, 'Nieuwstraat')
    await user.click(screen.getByTitle('cancel'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Kerkstraat 12-a, 1234 AB Amsterdam')).toBeInTheDocument()
  })

  it('other field types keep editing normally alongside the expanded address', async () => {
    const user = userEvent.setup()
    render(<EditableFieldTable fields={fields} value={value} />)
    await user.click(screen.getByTitle('edit'))
    expect(screen.getByDisplayValue('0612345678')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
  })
})
