/**
 * AddDepartmentModal — covers the house "wide form" adoption (Danny 27-07): the
 * card regroup (Algemeen/Zakelijk/Omschrijving) still submits the exact same
 * DepartmentPayload shape via `onCreate`, the location picker (bare <select>
 * before, now a searchable CreatableSelect, allowCreate={false}) actually filters
 * by typing, and the name/location-required validation still blocks an
 * incomplete submit.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddDepartmentModal from './AddDepartmentModal'

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
// The location trigger's accessible name is now its field LABEL (aria-labelledby
// self-reference drops the button's own visible text), not the selected value —
// the label doubles as the picker's placeholder (same i18n key), "*" for required.
const locationTriggerName = () => `${ct('subModal.selectLocation')}*`

const locations = [{ id: 'loc-1', name: 'Locatie Noord' }, { id: 'loc-2', name: 'Locatie Zuid' }]
const statuses = [{ value: 'st-1', label: 'Actief' }]

describe('AddDepartmentModal', () => {
  it('blocks submit while the name is empty', async () => {
    const onCreate = vi.fn()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    // A location is pre-selected (locations[0]) once locations exist, but the
    // required name is still blank — submit stays disabled.
    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('blocks submit and flags both fields when created with no locations available', async () => {
    const onCreate = vi.fn()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={[]} statuses={statuses} />)

    // No locations: the picker renders the "create a location first" notice instead.
    expect(screen.getByText(ct('subModal.noLocationsFirst'))).toBeInTheDocument()
    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('the location picker is searchable — typing narrows the option list, then picking updates the trigger', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    // Location defaults to the first entry (locations[0]), but the trigger's name
    // is the field label now — find it by that, not the selected value.
    await user.click(screen.getByRole('button', { name: locationTriggerName() }))

    const search = screen.getByPlaceholderText(ct('subModal.selectLocation'))
    await user.type(search, 'Zuid')

    // Filtering to "Zuid" narrows the OPTION list to the one match — the trigger's
    // own name never included "Locatie Noord" to begin with, so absence is a clean check.
    expect(screen.getByRole('button', { name: 'Locatie Zuid' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Locatie Noord' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Locatie Zuid' }))
    // Trigger's name stays the field label; assert the pick via its rendered text.
    expect(screen.getByRole('button', { name: locationTriggerName() })).toHaveTextContent('Locatie Zuid')
  })

  it('submits the same DepartmentPayload shape via onCreate once required fields are filled', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    // { exact: false }: the required field's label carries a nested "*" span,
    // which breaks an exact text match (mirrors AddContactPersonModal.test.tsx).
    await user.type(screen.getByLabelText(ct('subModal.departmentName'), { exact: false }), 'Thuiszorg')

    // Switch the pre-selected location to prove the field still lands in the
    // payload after becoming a CreatableSelect.
    await user.click(screen.getByRole('button', { name: locationTriggerName() }))
    await user.click(screen.getByRole('button', { name: 'Locatie Zuid' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Thuiszorg', locationId: 'loc-2',
    }))
  })

  it('hides the location picker and skips its validation when lockLocationId is set', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} lockLocationId="loc-1" />)

    expect(screen.queryByText(ct('subModal.selectLocation'))).not.toBeInTheDocument()

    // { exact: false }: the required field's label carries a nested "*" span,
    // which breaks an exact text match (mirrors AddContactPersonModal.test.tsx).
    await user.type(screen.getByLabelText(ct('subModal.departmentName'), { exact: false }), 'Thuiszorg')
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Thuiszorg', locationId: 'loc-1' }))
  })
})
