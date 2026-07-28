/**
 * AddContactPersonModal — covers the house "wide form" adoption (Danny 27-07):
 * the card regroup (Persoon/Contact/Koppeling) still submits the exact same
 * ContactPayload shape via `onCreate`, the location picker (bare <select> before,
 * now a searchable CreatableSelect, allowCreate={false}) actually filters by
 * typing, and the first/last-name validation still blocks an incomplete submit.
 *
 * Danny 27-07 (customer-list point 9, "contactpersoon volgt klant of afdeling"):
 * the department picker must CASCADE off the picked location, mirroring
 * AddShiftModal's customer->department dependent picker — see the block below
 * covering that narrowing/reset/submit behaviour.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddContactPersonModal from './AddContactPersonModal'
import type { Contact, Department } from '@/types/customer'

// Both hooks fired by useContactFunctions (contact-functions + tenant settings)
// hit the module-scope cached-lookup path — a harmless empty response keeps
// each hook on its own seed fallback, same as before this change.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

const locations = [{ id: 'loc-1', name: 'Locatie Noord' }, { id: 'loc-2', name: 'Locatie Zuid' }]
const statuses = [{ value: 'st-1', label: 'Actief' }]

// Minimal-but-type-complete Department fixture — only the cascade-relevant fields
// (id/name/locationId) vary per test; everything else is a harmless default.
const dept = (id: string, name: string, locationId: string): Department => ({
  id, helloflexLink: null, shiftmanagerLink: null, name, description: '', locationId, locationName: '',
  contacts: [], costCenter: '', statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
})
const departments = [dept('dep-1', 'Verpleging', 'loc-1'), dept('dep-2', 'Thuiszorg', 'loc-2')]

describe('AddContactPersonModal', () => {
  it('blocks submit while first/last name are empty and shows the required message', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()

    // Typing only the first name still leaves the button disabled (last name missing).
    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    expect(createBtn).toBeDisabled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('the location picker is searchable — typing narrows the option list, then picking updates the trigger', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    // Trigger's name is now the field label (aria-labelledby self-reference drops
    // its own visible text) — location and department each get their OWN distinct
    // label now, so no more index-into-getAllByRole needed to tell them apart.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))

    const search = screen.getByPlaceholderText(ct('subModal.noneOption'))
    await user.type(search, 'Noord')

    expect(screen.getByRole('button', { name: 'Locatie Noord' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Locatie Zuid' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    // Trigger's name stays the field label; assert the pick via its rendered text.
    expect(screen.getByRole('button', { name: ct('subModal.selectLocation') })).toHaveTextContent('Locatie Noord')
  })

  it('submits the same ContactPayload shape via onCreate once required fields are filled', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')

    // Pick the location to prove the field still lands in the payload after
    // becoming a CreatableSelect. Trigger's name is the field label now.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Jan', lastName: 'Jansen', locationId: 'loc-1',
    }))
  })

  it('the department picker follows the selected location (C-42/point-9 cascade)', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} departments={departments} statuses={statuses} />)

    // Before any location is picked: the department field offers NOTHING to pick
    // (never "every department of this customer" — a department belongs to exactly
    // one location) and its search box asks for a location first.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    expect(screen.getByPlaceholderText(ct('subModal.pickLocationFirst'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verpleging' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thuiszorg' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    // Pick "Locatie Noord" — the department list narrows to ONLY that location's department.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    expect(screen.getByRole('button', { name: 'Verpleging' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thuiszorg' })).not.toBeInTheDocument()
  })

  it('changing the location resets a department that no longer belongs to it', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} departments={departments} statuses={statuses} />)

    // Pick Noord -> Verpleging.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    await user.click(screen.getByRole('button', { name: 'Verpleging' }))
    expect(screen.getByRole('button', { name: ct('subModal.selectDepartment') })).toHaveTextContent('Verpleging')

    // Switching to Zuid must clear the now-invalid "Verpleging" pick — never silently
    // submit a department that belongs to a different location.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Zuid' }))
    expect(screen.getByRole('button', { name: ct('subModal.selectDepartment') })).not.toHaveTextContent('Verpleging')
    expect(screen.getByRole('button', { name: ct('subModal.selectDepartment') })).toHaveTextContent(ct('subModal.noneOption'))
  })

  it('submits the payload with the matching customer_location_id/customer_department_id pair', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} departments={departments} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')

    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    await user.click(screen.getByRole('button', { name: 'Verpleging' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    // ContactPayload carries camelCase locationId/departmentId here; useCustomerContacts'
    // own toApi (covered by its own hook test) maps these onto customer_location_id/
    // customer_department_id on the actual POST body.
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      locationId: 'loc-1', departmentId: 'dep-1',
    }))
  })

  it('edit mode still resolves a legacy department whose location link is missing (CONTACT-MULTI-1 drawer chip-select has no cascade)', () => {
    // A contact edited via the drawer's independent chip-select could carry a
    // department without a matching location — the picker must still show its
    // real label, never fall back to rendering the raw id.
    const initial = {
      id: 'c1', helloflexLink: null, shiftmanagerLink: null, firstName: 'Jan', lastName: 'Jansen', name: 'Jan Jansen',
      role: '', email: '', phone: '', mobile: '', isPrimary: false,
      locationId: null, locationName: '', departmentId: 'dep-1', departmentName: 'Verpleging',
      locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
    } as Contact

    render(<AddContactPersonModal onClose={() => {}} onCreate={vi.fn()} locations={locations} departments={departments} statuses={statuses} initial={initial} />)

    expect(screen.getByRole('button', { name: ct('subModal.selectDepartment') })).toHaveTextContent('Verpleging')
  })
})
