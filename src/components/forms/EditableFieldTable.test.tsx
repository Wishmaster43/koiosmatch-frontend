/**
 * EditableFieldTable · the 'address' composite type (Danny 2026-07-14): read mode
 * composes ONE line (street+no+suffix, postcode+city — mirrors the candidate
 * ProfileTab addressRow), editing expands it into its declared `addressFields`
 * loose child rows, and saving hands back a flat object (no nested 'address' key).
 * Also checks a plain sibling field (text + boolean toggle) is unaffected by that logic.
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

  // A boolean field renders as the shared Toggle (role="switch"), not a tick box —
  // Danny 28-07: "GEEN VINKJES MAAR TOGGLES".
  it('does not disturb a sibling plain/boolean field', () => {
    render(<EditableFieldTable fields={fields} value={value} />)
    expect(screen.getByText('0612345678')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
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
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })
})

// The 'name' composite — sibling of 'address' above (Danny 05-08): read mode
// composes ONE line ("Voornaam tussenvoegsel Achternaam"), editing expands the
// declared `nameFields` loose child rows, and saving hands back a flat object
// (no nested 'name' key).
const nameFields: FieldRow[] = [
  { key: 'firstName', label: 'First name' },
  { key: 'middleName', label: 'Middle name' },
  { key: 'lastName', label: 'Last name' },
]
const nameTableFields: FieldRow[] = [
  { key: 'name', label: 'Name', type: 'name', nameFields },
  { key: 'phone', label: 'Phone' },
]
const nameValue = { firstName: 'Jan', middleName: 'de', lastName: 'Vries', phone: '0612345678' }

describe('EditableFieldTable · name composite (read mode)', () => {
  it('composes one line: "firstName middleName lastName"', () => {
    render(<EditableFieldTable fields={nameTableFields} value={nameValue} />)
    expect(screen.getByText('Jan de Vries')).toBeInTheDocument()
  })

  it('skips an empty middle name without a double space', () => {
    render(<EditableFieldTable fields={nameTableFields} value={{ ...nameValue, middleName: '' }} />)
    expect(screen.getByText('Jan Vries')).toBeInTheDocument()
  })

  it('does not render the loose child field labels in read mode', () => {
    render(<EditableFieldTable fields={nameTableFields} value={nameValue} />)
    expect(screen.queryByText('First name')).toBeNull()
    expect(screen.queryByText('Middle name')).toBeNull()
  })

  it('falls back to an en dash when the whole name is empty', () => {
    render(<EditableFieldTable fields={nameTableFields} value={{ phone: '0612345678' }} />)
    expect(screen.getByText('–')).toBeInTheDocument()
  })
})

describe('EditableFieldTable · name composite (edit mode)', () => {
  it('expands into the loose nameFields once editing starts', async () => {
    const user = userEvent.setup()
    render(<EditableFieldTable fields={nameTableFields} value={nameValue} />)
    await user.click(screen.getByTitle('edit'))
    // The composed line is gone; each declared child field is now its own row.
    expect(screen.queryByText('Jan de Vries')).toBeNull()
    expect(screen.getByText('First name')).toBeInTheDocument()
    expect(screen.getByText('Middle name')).toBeInTheDocument()
    expect(screen.getByText('Last name')).toBeInTheDocument()
    // Loose inputs are pre-filled from the shared values object.
    expect(screen.getByDisplayValue('Jan')).toBeInTheDocument()
    expect(screen.getByDisplayValue('de')).toBeInTheDocument()
  })

  it('collapses back to one composed line and does not carry a nested "name" key on save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditableFieldTable fields={nameTableFields} value={nameValue} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    const first = screen.getByDisplayValue('Jan')
    await user.clear(first)
    await user.type(first, 'Piet')
    await user.click(screen.getByTitle('save'))

    // Back to read mode: one composed line, using the edited first name.
    expect(screen.getByText('Piet de Vries')).toBeInTheDocument()
    // The saved payload is flat — the child keys changed, no 'name' key was introduced.
    const saved = onSave.mock.calls[0][0]
    expect(saved.firstName).toBe('Piet')
    expect(saved.name).toBeUndefined()
    expect(saved.lastName).toBe('Vries')
  })

  it('cancel restores the original composed line without saving', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditableFieldTable fields={nameTableFields} value={nameValue} onSave={onSave} />)
    await user.click(screen.getByTitle('edit'))
    const first = screen.getByDisplayValue('Jan')
    await user.clear(first)
    await user.type(first, 'Piet')
    await user.click(screen.getByTitle('cancel'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Jan de Vries')).toBeInTheDocument()
  })
})

// Regression (M7/DRILL-DOWN-CONSISTENCY, 08-08): a GROUPED table with no top-level
// title used to still render the header bar (empty title text + a floating pencil)
// above the groups' own titled cards — measured on the match Contract & financieel
// card, "2 headers / 1 pencil / nothing to read". The bar must disappear and the one
// shared pencil (still ONE edit cycle for every group) must move onto the first
// group's own title row instead of being dropped.
describe('EditableFieldTable · grouped table with no top-level title (M7)', () => {
  const groupedFields: FieldRow[] = [
    { key: 'a', label: 'Field A', group: 'Group one' },
    { key: 'b', label: 'Field B', group: 'Group two' },
  ]
  const groupedValue = { a: 'Alpha', b: 'Beta' }

  it('renders no empty header bar above the group titles', () => {
    render(<EditableFieldTable fields={groupedFields} value={groupedValue} />)
    // Both group titles render as real headings...
    expect(screen.getByText('Group one')).toBeInTheDocument()
    expect(screen.getByText('Group two')).toBeInTheDocument()
    // ...and exactly ONE pencil exists for the whole table (no second, titleless bar).
    expect(screen.getAllByTitle('edit')).toHaveLength(1)
  })

  it('puts the shared pencil on the FIRST group only, and it edits every group at once', async () => {
    const user = userEvent.setup()
    render(<EditableFieldTable fields={groupedFields} value={groupedValue} />)
    await user.click(screen.getByTitle('edit'))
    // Entering edit mode via the (single) pencil edits BOTH groups in one cycle.
    expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Beta')).toBeInTheDocument()
  })

  it('still shows the ordinary top header when a title IS given, even when grouped', () => {
    render(<EditableFieldTable title="My table" fields={groupedFields} value={groupedValue} />)
    expect(screen.getByText('My table')).toBeInTheDocument()
    // Top header owns the pencil again; the group titles carry none of their own.
    expect(screen.getAllByTitle('edit')).toHaveLength(1)
  })

  it('keeps the titleless header bar (and its pencil) for an UNGROUPED table — unchanged', () => {
    // Mirrors DepartmentDetail's `title=""` usage: a deliberately empty title, no
    // `group` on any field, so the single header bar stays the only pencil spot.
    render(<EditableFieldTable title="" fields={[{ key: 'a', label: 'Field A' }]} value={{ a: 'Alpha' }} />)
    expect(screen.getByTitle('edit')).toBeInTheDocument()
  })
})

// Regression (Danny 28-07, found by an adversarial verification pass): the read view
// used to follow the last DRAFT, not the source of truth. If the parent stored something
// different from what was typed — declining "replace the primary contact?" saves
// isPrimary FALSE — the table kept showing the typed value until it unmounted.
describe('EditableFieldTable · the read view follows the parent, not the draft', () => {
  const boolFields: FieldRow[] = [{ key: 'isPrimary', label: 'Primair', type: 'checkbox' }]

  it('follows a value the parent changes from elsewhere while in read mode', () => {
    const { rerender } = render(<EditableFieldTable fields={boolFields} value={{ isPrimary: false }} onSave={vi.fn()} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    // Something else promoted this record (another screen, a server reconcile).
    rerender(<EditableFieldTable fields={boolFields} value={{ isPrimary: true }} onSave={vi.fn()} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('does not throw away an in-progress draft when the parent re-renders', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<EditableFieldTable fields={fields} value={value} onSave={vi.fn()} />)
    await user.click(screen.getByTitle('edit'))
    const street = screen.getByDisplayValue('Kerkstraat')
    await user.clear(street)
    await user.type(street, 'Nieuwstraat')
    // A parent re-render mid-edit (a poll, a sibling save) must not reset the draft.
    rerender(<EditableFieldTable fields={fields} value={{ ...value }} onSave={vi.fn()} />)
    expect(screen.getByDisplayValue('Nieuwstraat')).toBeInTheDocument()
  })
})
